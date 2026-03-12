"""Trail API endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from api.auth import AuthenticatedUser, require_auth
from api.models.trail import SyncMetadata, TrailDetailsResponse, TrailFilterParams, TrailResponse, TrailUpdate
from api.services.gpx_parser import parse_gpx_upload
from api.storage import trail_storage

logger = logging.getLogger(__name__)

MAX_GPX_SIZE = 10 * 1024 * 1024  # 10 MB (~5x largest Skåneleden GPX)

router = APIRouter(prefix="/trails", tags=["trails"])


@router.get("/sync")
def get_sync_metadata() -> SyncMetadata:
    """Get trail sync metadata (count + last_modified).

    Costs 1 Firestore read. Clients compare against local cache
    to decide whether a full or delta fetch is needed.
    """
    return trail_storage.get_sync_metadata()


@router.get("")
def list_trails(filters: Annotated[TrailFilterParams, Query()]) -> list[TrailResponse]:
    """List all trails with optional filtering."""
    trails = trail_storage.get_all_trails(source=filters.source, since=filters.since)

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
def get_trail(trail_id: str) -> TrailResponse:
    """Get a single trail by ID."""
    trail = trail_storage.get_trail(trail_id)
    if not trail:
        raise HTTPException(status_code=404, detail="Trail not found")
    return trail


@router.get("/{trail_id}/details")
def get_trail_details(trail_id: str) -> TrailDetailsResponse:
    """Get detailed trail data (full coordinates, elevation profile)."""
    details = trail_storage.get_trail_details(trail_id)
    if not details:
        raise HTTPException(status_code=404, detail="Trail details not found")
    return details


@router.patch("/{trail_id}")
def update_trail(
    trail_id: str, body: TrailUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> TrailResponse:
    """Update trail fields (name, status, difficulty)."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    if existing.created_by and existing.created_by != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to modify this trail")

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
    """Delete a trail and its details."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    if existing.created_by and existing.created_by != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to delete this trail")

    trail_storage.delete_trail(trail_id)


@router.post("/upload", status_code=201)
def upload_gpx(
    file: UploadFile,
    user: Annotated[AuthenticatedUser, Depends(require_auth)],
    source: Annotated[
        str,
        Query(
            pattern=r"^(other_trails|world_wide_hikes)$", description="Trail source: other_trails or world_wide_hikes"
        ),
    ] = "other_trails",
) -> list[TrailResponse]:
    """Upload a GPX file and save parsed trails to Firestore.

    Uploaded trails are marked as 'Explored!' since they represent completed hikes.
    Returns the list of saved trails.
    """
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
        trails = parse_gpx_upload(content, source=source)
    except ValueError as e:
        detail = str(e)
        if "Invalid GPX file:" in detail:
            detail = "Invalid GPX file: the file could not be parsed"
        raise HTTPException(status_code=400, detail=detail) from e

    for trail in trails:
        trail.created_by = user.uid
        trail_storage.save_trail(trail, update_sync=False)

    # Update sync metadata once after bulk save (not per-trail)
    trail_storage.update_sync_metadata()

    logger.info("Uploaded %d trail(s) from %s", len(trails), file.filename)
    return trails
