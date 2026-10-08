"""Tombstones for deleted trails, so clients can delta-sync deletions.

Each deleted trail leaves a tiny `trail_tombstones` document (same ID as the trail)
holding the trail's visibility and deletion time. Clients ask for everything deleted
since their last sync instead of comparing full ID lists.
"""

from typing import Any

from api.storage.firestore_client import get_collection

COLLECTION = "trail_tombstones"


def record_tombstone(trail_id: str, trail_data: dict[str, Any], deleted_at: str) -> None:
    """Record that a trail was deleted.

    Args:
        trail_id: ID of the deleted trail.
        trail_data: The trail's Firestore document as it was before deletion.
        deleted_at: ISO timestamp (Z-suffix UTC) of the deletion.
    """
    get_collection(COLLECTION).document(trail_id).set(
        {
            "trail_id": trail_id,
            "group_id": trail_data.get("group_id"),
            "is_public": trail_data.get("is_public", False),
            "deleted_at": deleted_at,
        }
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
