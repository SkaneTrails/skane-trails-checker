"""Trail API endpoints.

Group-scoped access:
- GET endpoints: any authenticated group member sees group + public trails
- Write endpoints: admin of group (or superuser) only
- Members are view-only
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from api.auth import AuthenticatedUser, require_auth, require_group
from api.models.trail import (
    RecordingCreate,
    SyncMetadata,
    TrailDetailsResponse,
    TrailFilterParams,
    TrailResponse,
    TrailUpdate,
)
from api.services.gpx_parser import parse_gpx_upload
from api.services.recording_processor import process_recording
from api.storage import trail_storage

logger = logging.getLogger(__name__)

MAX_GPX_SIZE = 10 * 1024 * 1024  # 10 MB (~5x largest Skåneleden GPX)

router = APIRouter(prefix="/trails", tags=["trails"])


def _require_write_access(user: AuthenticatedUser, trail: TrailResponse) -> None:
    """Require admin/SU access to modify a trail."""
    if user.role == "superuser":
        return
    if trail.group_id is None:
        raise HTTPException(status_code=403, detail="Only superusers can modify public trails")
    if user.role != "admin" or user.group_id != trail.group_id:
        raise HTTPException(status_code=403, detail="Admin access required to modify group trails")


def _require_admin_role(user: AuthenticatedUser) -> None:
    """Require admin or superuser role for creating content."""
    if user.role in ("admin", "superuser"):
        return
    raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/sync")
def get_sync_metadata() -> SyncMetadata:
    """Get trail sync metadata (count + last_modified).

    Costs 1 Firestore read. Clients compare against local cache
    to decide whether a full or delta fetch is needed.
    """
    return trail_storage.get_sync_metadata()


@router.get("")
def list_trails(
    filters: Annotated[TrailFilterParams, Query()], user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> list[TrailResponse]:
    """List trails visible to the current user.

    Group members see their group's trails + public (bootstrapped) trails.
    Superusers see all trails.
    """
    group_id = None if user.role == "superuser" else require_group(user)
    trails = trail_storage.get_all_trails(source=filters.source, since=filters.since, group_id=group_id)

    if filters.search:
        query_lower = filters.search.lower()
        trails = [t for t in trails if query_lower in t.name.lower()]

    if filters.min_distance_km is not None:
        trails = [t for t in trails if t.length_km >= filters.min_distance_km]

    if filters.max_distance_km is not None:
        trails = [t for t in trails if t.length_km <= filters.max_distance_km]

    if filters.status:
        trails = [t for t in trails if t.status == filters.status]

    # Sort: uploaded trails first (non-planned), planned hikes last.
    # Within each group, sort alphabetically by name.
    trails.sort(key=lambda t: (t.source == "planned_hikes", t.name.lower()))

    return trails


@router.get("/{trail_id}")
def get_trail(trail_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> TrailResponse:
    """Get a single trail by ID. Must have access to the trail's group."""
    trail = trail_storage.get_trail(trail_id)
    if not trail:
        raise HTTPException(status_code=404, detail="Trail not found")

    if trail.group_id is not None and user.role != "superuser" and user.group_id != trail.group_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this trail")

    return trail


@router.get("/{trail_id}/details")
def get_trail_details(trail_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> TrailDetailsResponse:
    """Get detailed trail data (full coordinates, elevation profile)."""
    trail = trail_storage.get_trail(trail_id)
    if not trail:
        raise HTTPException(status_code=404, detail="Trail not found")

    if trail.group_id is not None and user.role != "superuser" and user.group_id != trail.group_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this trail")

    details = trail_storage.get_trail_details(trail_id)
    if not details:
        raise HTTPException(status_code=404, detail="Trail details not found")
    return details


@router.patch("/{trail_id}")
def update_trail(
    trail_id: str, body: TrailUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> TrailResponse:
    """Update trail fields (name, status, difficulty). Admin or superuser."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    _require_write_access(user, existing)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    trail_storage.update_trail(trail_id, updates)

    updated = trail_storage.get_trail(trail_id)
    if not updated:  # pragma: no cover
        raise HTTPException(status_code=404, detail="Trail not found after update")
    return updated


@router.delete("/{trail_id}", status_code=204)
def delete_trail(trail_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a trail and its details. Admin or superuser."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    _require_write_access(user, existing)

    trail_storage.delete_trail(trail_id)


@router.post("/upload", status_code=201)
def upload_gpx(file: UploadFile, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[TrailResponse]:
    """Upload a GPX file and save parsed trails to Firestore.

    Admin or superuser only. Trails are assigned to the user's group.
    """
    _require_admin_role(user)

    if not file.filename or not file.filename.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="File must be a .gpx file")

    try:
        content = file.file.read()
    except Exception:  # pragma: no cover
        logger.exception("Failed to read uploaded file")
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")  # noqa: B904

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > MAX_GPX_SIZE:
        size_mib = len(content) / (1024 * 1024)
        max_mib = MAX_GPX_SIZE / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=(
                f"GPX file too large ({len(content)} bytes, {size_mib:.2f} MiB). "
                f"Maximum size is {MAX_GPX_SIZE} bytes ({max_mib:.2f} MiB)."
            ),
        )

    try:
        trails = parse_gpx_upload(content)
    except ValueError as e:
        detail = str(e)
        if "Invalid GPX file:" in detail:
            detail = "Invalid GPX file: the file could not be parsed"
        raise HTTPException(status_code=400, detail=detail) from e

    group_id = None if user.role == "superuser" else require_group(user)
    for trail in trails:
        trail.created_by = user.uid
        trail.group_id = group_id
        trail_storage.save_trail(trail, update_sync=False)

    # Update sync metadata once after bulk save (not per-trail)
    trail_storage.update_sync_metadata()

    logger.info("Uploaded %d trail(s) from %s", len(trails), file.filename)
    return trails


@router.post("/record", status_code=201)
def save_recording(body: RecordingCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> TrailResponse:
    """Save a GPS recording as a trail.

    Admin or superuser only. Accepts raw GPS coordinates (from device tracking),
    computes distance, elevation, bounds, and simplified coordinates.
    """
    _require_admin_role(user)

    group_id = None if user.role == "superuser" else require_group(user)
    trail, details = process_recording(name=body.name, coordinates=body.coordinates, user_uid=user.uid)
    trail.group_id = group_id

    trail_storage.save_trail(trail)
    trail_storage.save_trail_details(details)

    logger.info("Saved GPS recording '%s' (%d points)", body.name, len(body.coordinates))
    return trail
