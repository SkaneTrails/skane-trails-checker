"""Firestore storage operations for trails."""

import logging
from datetime import UTC, datetime
from typing import Any

from api.models.trail import Coordinate, SyncMetadata, TrailBounds, TrailDetailsResponse, TrailResponse
from api.storage.firestore_client import get_collection
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)


def _doc_to_trail(data: dict) -> TrailResponse:
    """Convert a Firestore document dict to a TrailResponse model."""
    bounds_data = data.get("bounds", {})
    center_data = data.get("center", {})

    return TrailResponse(
        trail_id=data["trail_id"],
        name=data["name"],
        difficulty=data.get("difficulty", "Unknown"),
        length_km=data.get("length_km", 0.0),
        status=data.get("status", "To Explore"),
        coordinates_map=[
            Coordinate(lat=coord["lat"], lng=coord["lng"], elevation=coord.get("elevation"))
            for coord in data.get("coordinates_map", [])
        ],
        bounds=TrailBounds(
            north=bounds_data.get("north", 0.0),
            south=bounds_data.get("south", 0.0),
            east=bounds_data.get("east", 0.0),
            west=bounds_data.get("west", 0.0),
        ),
        center=Coordinate(lat=center_data.get("lat", 0.0), lng=center_data.get("lng", 0.0)),
        source=data.get("source", ""),
        last_updated=data.get("last_updated", ""),
        created_at=data.get("created_at"),
        modified_at=data.get("modified_at"),
        activity_date=data.get("activity_date"),
        activity_type=data.get("activity_type"),
        elevation_gain=data.get("elevation_gain"),
        elevation_loss=data.get("elevation_loss"),
        duration_minutes=data.get("duration_minutes"),
        avg_inclination_deg=data.get("avg_inclination_deg"),
        max_inclination_deg=data.get("max_inclination_deg"),
        created_by=data.get("created_by"),
        group_id=data.get("group_id"),
    )


def _doc_to_trail_details(data: dict) -> TrailDetailsResponse:
    """Convert a Firestore document dict to a TrailDetailsResponse model."""
    return TrailDetailsResponse(
        trail_id=data["trail_id"],
        coordinates_full=[
            Coordinate(lat=coord["lat"], lng=coord["lng"], elevation=coord.get("elevation"))
            for coord in data.get("coordinates_full", [])
        ],
        elevation_profile=data.get("elevation_profile"),
        waypoints=data.get("waypoints"),
        statistics=data.get("statistics"),
    )


def get_all_trails(
    source: str | None = None, since: str | None = None, group_id: str | None = None
) -> list[TrailResponse]:
    """Get all trails, filtered by group and optionally by source/created_at.

    Args:
        source: Filter by trail source (planned_hikes, other_trails, world_wide_hikes).
        since: ISO timestamp — return only trails with created_at >= this value.
        group_id: If provided, return trails belonging to this group PLUS
            public trails (group_id is None). If not provided (superuser),
            return all trails.
    """
    logger.info("Loading trails (source=%s, since=%s, group_id=%s)", source, since, group_id)
    collection = get_collection("trails")

    if group_id is not None:
        trails = _fetch_group_and_public_trails(collection, group_id, source, since)
    else:
        trails = _fetch_all_trails(collection, source, since)

    logger.info("Loaded %d trails", len(trails))
    return trails


def _fetch_all_trails(collection: Any, source: str | None, since: str | None) -> list[TrailResponse]:
    """Fetch all trails (superuser view)."""
    query = collection.where("source", "==", source) if source else collection
    if since:
        query = query.where("created_at", ">=", since)
    return [_doc_to_trail(data) for doc in query.stream() if (data := doc.to_dict())]


def _fetch_group_and_public_trails(
    collection: Any, group_id: str, source: str | None, since: str | None
) -> list[TrailResponse]:
    """Fetch trails belonging to a group plus public (no group_id) trails."""
    trails = []
    seen_ids: set[str] = set()

    # Query 1: Group's own trails
    group_query = collection.where("group_id", "==", group_id)
    if source:
        group_query = group_query.where("source", "==", source)
    if since:
        group_query = group_query.where("created_at", ">=", since)
    for doc in group_query.stream():
        data = doc.to_dict()
        if data:
            trail = _doc_to_trail(data)
            trails.append(trail)
            seen_ids.add(trail.trail_id)

    # Query 2: Public trails (group_id == None)
    public_query = collection.where("group_id", "==", None)
    if source:
        public_query = public_query.where("source", "==", source)
    if since:
        public_query = public_query.where("created_at", ">=", since)
    for doc in public_query.stream():
        data = doc.to_dict()
        if data:
            trail = _doc_to_trail(data)
            if trail.trail_id not in seen_ids:
                trails.append(trail)

    return trails


def save_trail(trail: TrailResponse, *, update_sync: bool = True) -> None:
    """Save or update a trail in Firestore.

    Args:
        trail: The trail to save.
        update_sync: Whether to update sync metadata. Set to False during
            bulk imports (e.g. GPX upload) and call _update_sync_metadata()
            once after the loop.
    """
    validate_document_id(trail.trail_id, field_name="trail_id")
    logger.info("Saving trail: %s (ID: %s, Source: %s)", trail.name, trail.trail_id, trail.source)
    now = _utc_now_z()
    trail.last_updated = now
    if not trail.created_at:
        trail.created_at = now
    get_collection("trails").document(trail.trail_id).set(trail.to_dict())
    if update_sync:
        _update_sync_metadata()


def save_trail_details(details: TrailDetailsResponse) -> None:
    """Save or update trail details in Firestore."""
    validate_document_id(details.trail_id, field_name="trail_id")
    logger.info("Saving trail details for: %s", details.trail_id)
    get_collection("trail_details").document(details.trail_id).set(details.to_dict())


def get_trail(trail_id: str) -> TrailResponse | None:
    """Get a single trail by ID."""
    validate_document_id(trail_id, field_name="trail_id")
    doc = get_collection("trails").document(trail_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return _doc_to_trail(data) if data else None


def get_trail_details(trail_id: str) -> TrailDetailsResponse | None:
    """Get detailed trail data for a specific trail."""
    validate_document_id(trail_id, field_name="trail_id")
    doc = get_collection("trail_details").document(trail_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return _doc_to_trail_details(data) if data else None


def update_trail_status(trail_id: str, status: str) -> None:
    """Update the status of a trail."""
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Updating trail %s status to: %s", trail_id, status)
    get_collection("trails").document(trail_id).update({"status": status, "last_updated": _utc_now_z()})


def update_trail_name(trail_id: str, name: str) -> None:
    """Update the name of a trail."""
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Updating trail %s name to: %s", trail_id, name)
    get_collection("trails").document(trail_id).update({"name": name, "last_updated": _utc_now_z()})


def update_trail(trail_id: str, updates: dict) -> None:
    """Update multiple fields of a trail."""
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Updating trail %s with fields: %s", trail_id, list(updates.keys()))
    updates["last_updated"] = _utc_now_z()
    get_collection("trails").document(trail_id).update(updates)
    _update_sync_metadata()


def delete_trail(trail_id: str, *, update_sync: bool = True) -> None:
    """Delete a trail and its details from Firestore."""
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Deleting trail %s", trail_id)
    get_collection("trails").document(trail_id).delete()
    get_collection("trail_details").document(trail_id).delete()
    if update_sync:
        _update_sync_metadata()


def get_sync_metadata() -> SyncMetadata:
    """Get trail sync metadata (count + last_modified).

    Reads from the _meta/trails_sync document. Cost: 1 Firestore read.
    """
    doc = get_collection("_meta").document("trails_sync").get()
    if not doc.exists:
        return SyncMetadata(count=0, last_modified=None)
    data = doc.to_dict()
    if not data:
        return SyncMetadata(count=0, last_modified=None)
    return SyncMetadata(count=data.get("count", 0), last_modified=data.get("last_modified"))


def _utc_now_z() -> str:
    """Return current UTC time as ISO string with Z suffix (not +00:00)."""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def update_sync_metadata() -> None:
    """Public wrapper for sync metadata update.

    Use after bulk operations (e.g. GPX upload) where
    individual save_trail calls use update_sync=False.
    """
    _update_sync_metadata()


def _update_sync_metadata() -> None:
    """Recalculate and update the trail sync metadata document.

    Uses a Firestore aggregation query to count documents server-side,
    avoiding O(N) client reads from streaming the entire collection.
    Called after trail create, update, or delete.
    """
    now = _utc_now_z()
    collection = get_collection("trails")
    count_result = collection.count().get()
    count = count_result[0][0].value
    get_collection("_meta").document("trails_sync").set({"count": count, "last_modified": now})
