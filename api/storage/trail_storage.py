"""Firestore storage operations for trails."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from api.models.trail import (
    Coordinate,
    ImagePin,
    SyncMetadata,
    TrailBounds,
    TrailChangesResponse,
    TrailDetailsResponse,
    TrailImage,
    TrailImagesResponse,
    TrailResponse,
)
from api.storage.firestore_client import create_batch, get_collection, run_in_transaction
from api.storage.sync_status import touch
from api.storage.trail_tombstones import add_tombstone, get_deleted_trail_ids
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)

# A write takes its timestamp before it commits, so one can land just after a sync chose its cursor
# yet carry an older time. The cursor trails the clock by this much so such a write is delivered
# again next time (changes are applied idempotently) instead of being missed for good.
CURSOR_OVERLAP = timedelta(minutes=2)

# Fields returned for the "summary" list view (everything except the heavy
# coordinates_map polyline). Used with Firestore query.select() so the
# coordinate arrays are never read or deserialized server-side.
_SUMMARY_FIELDS: tuple[str, ...] = (
    "trail_id",
    "name",
    "difficulty",
    "length_km",
    "status",
    "bounds",
    "center",
    "source",
    "last_updated",
    "created_at",
    "modified_at",
    "activity_date",
    "activity_type",
    "elevation_gain",
    "elevation_loss",
    "duration_minutes",
    "avg_inclination_deg",
    "max_inclination_deg",
    "created_by",
    "group_id",
    "line_color",
    "is_public",
    "images_revision",
)


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
        # Fallback chain for modified_at: prefer last_updated (better proxy for last modification)
        modified_at=data.get("modified_at") or data.get("last_updated") or data.get("created_at"),
        activity_date=data.get("activity_date"),
        activity_type=data.get("activity_type"),
        elevation_gain=data.get("elevation_gain"),
        elevation_loss=data.get("elevation_loss"),
        duration_minutes=data.get("duration_minutes"),
        avg_inclination_deg=data.get("avg_inclination_deg"),
        max_inclination_deg=data.get("max_inclination_deg"),
        created_by=data.get("created_by"),
        group_id=data.get("group_id"),
        line_color=data.get("line_color"),
        is_public=data.get("is_public", False),
        images_revision=data.get("images_revision"),
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
    source: str | None = None, since: str | None = None, group_id: str | None = None, *, summary: bool = False
) -> list[TrailResponse]:
    """Get all trails, filtered by group and optionally by source/modified_at.

    Args:
        source: Filter by trail source (planned_hikes, other_trails, world_wide_hikes).
        since: ISO timestamp — return only trails with modified_at >= this value.
        group_id: If provided, return trails belonging to this group PLUS
            public trails (group_id is None). If not provided (superuser),
            return all trails.
        summary: When True, project away coordinates_map via Firestore
            select() so the heavy polyline arrays are never read or
            deserialized server-side.
    """
    logger.info("Loading trails (source=%s, since=%s, group_id=%s, summary=%s)", source, since, group_id, summary)
    collection = get_collection("trails")

    if group_id is not None:
        trails = _fetch_group_and_public_trails(collection, group_id, source, since, summary=summary)
    else:
        trails = _fetch_all_trails(collection, source, since, summary=summary)

    logger.info("Loaded %d trails", len(trails))
    return trails


def _select_summary(query: Any) -> Any:
    """Project a query to summary fields only (excludes coordinates_map)."""
    return query.select(list(_SUMMARY_FIELDS))


def _fetch_all_trails(
    collection: Any, source: str | None, since: str | None, *, summary: bool = False
) -> list[TrailResponse]:
    """Fetch all trails (superuser view)."""
    query = collection.where("source", "==", source) if source else collection
    if since:
        query = query.where("modified_at", ">=", since)
    if summary:
        query = _select_summary(query)
    return [_doc_to_trail(data) for doc in query.stream() if (data := doc.to_dict())]


def _fetch_group_and_public_trails(
    collection: Any, group_id: str, source: str | None, since: str | None, *, summary: bool = False
) -> list[TrailResponse]:
    """Fetch trails belonging to a group plus public/bootstrapped trails.

    Returns the union of:
    1. Trails belonging to the user's group
    2. Bootstrapped trails (group_id == None, legacy public data)
    3. Trails explicitly marked as public (is_public == True) from any group
    """
    trails = []
    seen_ids: set[str] = set()

    def _apply_filters(query: Any) -> Any:
        if source:
            query = query.where("source", "==", source)
        if since:
            query = query.where("modified_at", ">=", since)
        if summary:
            query = _select_summary(query)
        return query

    def _collect(query: Any) -> None:
        for doc in query.stream():
            data = doc.to_dict()
            if data:
                trail = _doc_to_trail(data)
                if trail.trail_id not in seen_ids:
                    trails.append(trail)
                    seen_ids.add(trail.trail_id)

    # Query 1: Group's own trails
    _collect(_apply_filters(collection.where("group_id", "==", group_id)))

    # Query 2: Bootstrapped trails (group_id == None)
    _collect(_apply_filters(collection.where("group_id", "==", None)))

    # Query 3: Explicitly public trails from other groups
    _collect(_apply_filters(collection.where("is_public", "==", True)))

    return trails


def save_trail(trail: TrailResponse, *, update_sync: bool = True) -> None:
    """Save or update a trail in Firestore.

    Trail IDs are stable (re-uploading a GPX reuses its ID), so a save can overwrite a trail that
    other groups can see with one they cannot, such as a public trail re-uploaded as private. The
    previous document is read in the same transaction and, if its audience shrinks, a tombstone is
    written for it so those groups drop their copy.

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
    trail.modified_at = now
    if not trail.created_at:
        trail.created_at = now
    trail_ref = get_collection("trails").document(trail.trail_id)
    data = trail.to_dict()
    run_in_transaction(lambda transaction: _overwrite_trail(transaction, trail_ref, trail.trail_id, data, now))
    trail.images_revision = data.get("images_revision")
    if update_sync:
        _update_sync_metadata()


def _overwrite_trail(transaction: Any, trail_ref: Any, trail_id: str, data: dict, now: str) -> None:
    snapshot = trail_ref.get(transaction=transaction)
    previous = snapshot.to_dict() if snapshot.exists else None
    # The photos live in their own document and survive an overwrite, so the trail keeps their revision.
    if previous and previous.get("images_revision") and "images_revision" not in data:
        data["images_revision"] = previous["images_revision"]
    transaction.set(trail_ref, data)
    if previous and _audience_shrinks(previous, data):
        add_tombstone(transaction, trail_id, previous, now)


def _audience_shrinks(previous: dict, current: dict) -> bool:
    """Whether someone who could see the previous trail may no longer see the current one."""
    lost_public = bool(previous.get("is_public")) and not current.get("is_public")
    return lost_public or previous.get("group_id") != current.get("group_id")


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
    now = _utc_now_z()
    get_collection("trails").document(trail_id).update({"status": status, "last_updated": now, "modified_at": now})


def update_trail_name(trail_id: str, name: str) -> None:
    """Update the name of a trail."""
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Updating trail %s name to: %s", trail_id, name)
    now = _utc_now_z()
    get_collection("trails").document(trail_id).update({"name": name, "last_updated": now, "modified_at": now})


def update_trail(trail_id: str, updates: dict) -> None:
    """Update multiple fields of a trail.

    Making a shared trail private also leaves a tombstone, written in the same transaction that
    read the trail's sharing, so the groups that saw it drop their copy even if the sharing is
    changed concurrently. Its owner keeps the trail because it is still in their delta.
    """
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Updating trail %s with fields: %s", trail_id, list(updates.keys()))
    now = _utc_now_z()
    updates["last_updated"] = now
    updates["modified_at"] = now
    trail_ref = get_collection("trails").document(trail_id)
    if updates.get("is_public") is False:
        run_in_transaction(lambda transaction: _make_private(transaction, trail_ref, trail_id, updates, now))
    else:
        trail_ref.update(updates)
    _update_sync_metadata()


def _make_private(transaction: Any, trail_ref: Any, trail_id: str, updates: dict, now: str) -> None:
    """Apply an update that stops sharing a trail, with a tombstone if it was shared."""
    snapshot = trail_ref.get(transaction=transaction)
    previous = snapshot.to_dict() if snapshot.exists else None
    transaction.update(trail_ref, updates)
    if previous and previous.get("is_public"):
        add_tombstone(transaction, trail_id, previous, now)


def delete_trail(trail_id: str, *, update_sync: bool = True) -> None:
    """Delete a trail and its details, with a tombstone for client delta sync, in one transaction.

    The transaction reads who could see the trail and writes the tombstone for that audience, so a
    concurrent change of sharing cannot leave the recorded audience stale.
    """
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Deleting trail %s", trail_id)
    trail_ref = get_collection("trails").document(trail_id)
    run_in_transaction(lambda transaction: _delete_with_tombstone(transaction, trail_ref, trail_id))
    if update_sync:
        _update_sync_metadata()


def _delete_with_tombstone(transaction: Any, trail_ref: Any, trail_id: str) -> None:
    snapshot = trail_ref.get(transaction=transaction)
    trail_data = snapshot.to_dict() if snapshot.exists else None
    transaction.delete(trail_ref)
    transaction.delete(get_collection("trail_details").document(trail_id))
    if trail_data is not None:
        add_tombstone(transaction, trail_id, trail_data, _utc_now_z())


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


def get_trail_changes(since: str | None, group_id: str | None) -> TrailChangesResponse:
    """Get trails changed and trail IDs deleted since a timestamp, for client delta sync.

    Args:
        since: ISO timestamp from a previous response's server_time. None returns every trail.
        group_id: Caller's group (their trails plus public ones), or None for a superuser.

    Returns:
        Changed trails (with coordinates), deleted IDs, and the time to use as the next `since`.
        A trail that is in the changed list is never also reported deleted (it was recreated, or
        is still visible to this caller after being made private to others), so the client can
        apply deletions and changes in any order. The returned time is taken before the data is
        read and trails the clock by CURSOR_OVERLAP, so writes that commit shortly after their own
        timestamp are picked up by the next sync; the overlap re-delivers a few recent changes.
    """
    server_time = _utc_now_z(CURSOR_OVERLAP)
    trails = get_all_trails(since=since, group_id=group_id)
    changed_ids = {trail.trail_id for trail in trails}
    deleted_ids = [trail_id for trail_id in get_deleted_trail_ids(since, group_id) if trail_id not in changed_ids]
    return TrailChangesResponse(
        trails=trails,
        deleted_ids=deleted_ids,
        server_time=server_time,
        scope="all" if group_id is None else f"group:{group_id}",
    )


def _utc_now_z(earlier_by: timedelta = timedelta(0)) -> str:
    """Return the current UTC time, optionally moved back, as an ISO string with Z suffix."""
    return (datetime.now(UTC) - earlier_by).strftime("%Y-%m-%dT%H:%M:%SZ")


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
    _write_legacy_trails_sync()
    touch("trails")


def _write_legacy_trails_sync() -> None:
    """Write the count and last_modified that `GET /trails/sync` serves."""
    now = _utc_now_z()
    collection = get_collection("trails")
    count_result = collection.count().get()
    count = count_result[0][0].value
    get_collection("_meta").document("trails_sync").set({"count": count, "last_modified": now})


def get_trail_images(trail_id: str) -> TrailImagesResponse:
    """Get images for a trail."""
    validate_document_id(trail_id, field_name="trail_id")
    doc = get_collection("trail_images").document(trail_id).get()
    if not doc.exists:
        return TrailImagesResponse(trail_id=trail_id, images=[])
    data = doc.to_dict()
    if not data:
        return TrailImagesResponse(trail_id=trail_id, images=[])
    images = [
        TrailImage(
            image_data=img["image_data"],
            role=img["role"],
            lat=img.get("lat"),
            lng=img.get("lng"),
            caption=img.get("caption"),
            thumbnail=img.get("thumbnail"),
        )
        for img in data.get("images", [])
    ]
    return TrailImagesResponse(trail_id=trail_id, images=images, revision=data.get("revision"))


def save_trail_images(trail_id: str, images: list[TrailImage]) -> str:
    """Save trail images to Firestore and give them a new revision.

    The images and the trail's `images_revision` are written in one batch, so a client that sees
    a trail's revision in its delta and then loads the photos can never get an older set. The
    trail's `modified_at` moves too, which delivers the new revision through `/trails/changes`.
    Afterwards the `trails` and `images` sync markers change.

    Note: With 800px/60% JPEG compression, images are typically 50-100KB each.
    Max 3 images stays well under Firestore's 1 MiB document limit.

    Returns:
        The new revision.
    """
    validate_document_id(trail_id, field_name="trail_id")
    logger.info("Saving %d image(s) for trail %s", len(images), trail_id)
    revision = uuid4().hex
    now = _utc_now_z()
    data = {
        "trail_id": trail_id,
        "revision": revision,
        "images": [
            {
                "image_data": img.image_data,
                "role": img.role,
                **({"lat": img.lat} if img.lat is not None else {}),
                **({"lng": img.lng} if img.lng is not None else {}),
                **({"caption": img.caption} if img.caption is not None else {}),
                **({"thumbnail": img.thumbnail} if img.thumbnail is not None else {}),
            }
            for img in images
        ],
    }
    batch = create_batch()
    batch.set(get_collection("trail_images").document(trail_id), data)
    batch.update(
        get_collection("trails").document(trail_id),
        {"images_revision": revision, "modified_at": now, "last_updated": now},
    )
    # The markers commit with the data, so a failure cannot leave changed photos that clients are never told about.
    touch("trails", "images", batch=batch)
    batch.commit()
    try:
        _write_legacy_trails_sync()
    except Exception:
        # Only `GET /trails/sync` reads it; failing the request now would invite a duplicate upload.
        logger.warning("Could not update the legacy trails_sync document", exc_info=True)
    return revision


def delete_trail_images(trail_id: str) -> None:
    """Delete trail images document (used when the trail itself is deleted)."""
    validate_document_id(trail_id, field_name="trail_id")
    get_collection("trail_images").document(trail_id).delete()
    touch("images")


def get_image_pins(trail_ids: list[str]) -> list[ImagePin]:
    """Get lightweight image pins for map display.

    Returns only the primary image thumbnail + GPS coords for given trail IDs.
    Reads one Firestore document per trail that has images.
    """
    if not trail_ids:
        return []

    pins: list[ImagePin] = []
    collection = get_collection("trail_images")

    # Firestore 'in' queries support max 30 items per batch
    for i in range(0, len(trail_ids), 30):
        batch_ids = trail_ids[i : i + 30]
        docs = collection.where("trail_id", "in", batch_ids).stream()
        for doc in docs:
            data = doc.to_dict()
            if not data:
                continue
            for img in data.get("images", []):
                if img.get("role") != "primary":
                    continue
                lat = img.get("lat")
                lng = img.get("lng")
                thumbnail = img.get("thumbnail")
                if lat is not None and lng is not None and thumbnail:
                    pins.append(ImagePin(trail_id=data["trail_id"], lat=lat, lng=lng, thumbnail=thumbnail))
                break  # Only one primary per trail
    return pins
