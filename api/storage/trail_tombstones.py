"""Tombstones for trails that deleted or stopped being shared, so clients can delta-sync removals.

Each one is a tiny `trail_tombstones` document (same ID as the trail) holding who could see the
trail and when it went away. Clients ask for everything removed since their last sync instead of
comparing full ID lists. A tombstone is written in the same batch as the change it records, so
the two can never disagree. It is never deleted; a trail that comes back is reported as changed
and `get_trail_changes` leaves it out of the removed IDs.
"""

from typing import Any

from api.storage.firestore_client import get_collection

COLLECTION = "trail_tombstones"


def add_tombstone_to_batch(batch: Any, trail_id: str, trail_data: dict[str, Any], deleted_at: str) -> None:
    """Add a tombstone write to a Firestore batch.

    Args:
        batch: The batch that also carries the deletion or visibility change.
        trail_id: ID of the trail that went away for some viewers.
        trail_data: The trail's Firestore document as it was before the change; its group and
            sharing decide who is told.
        deleted_at: ISO timestamp (Z-suffix UTC) of the change.
    """
    batch.set(
        get_collection(COLLECTION).document(trail_id),
        {
            "trail_id": trail_id,
            "group_id": trail_data.get("group_id"),
            "is_public": trail_data.get("is_public", False),
            "deleted_at": deleted_at,
        },
    )


def get_deleted_trail_ids(since: str | None, group_id: str | None) -> list[str]:
    """Get IDs of trails deleted since a timestamp that the caller could see.

    Args:
        since: ISO timestamp. Without it there is nothing to reconcile (a full fetch
            has no stale local copies), so no read is made.
        group_id: The caller's group, or None for a superuser who sees everything.
            Group members see their group's trails plus public ones.

    Returns:
        IDs of the deleted trails.
    """
    if since is None:
        return []

    query = get_collection(COLLECTION).where("deleted_at", ">=", since)
    visible: list[str] = []
    for doc in query.stream():
        data = doc.to_dict()
        if not data:
            continue
        if group_id is None or data.get("group_id") in (group_id, None) or data.get("is_public"):
            visible.append(data["trail_id"])
    return visible
