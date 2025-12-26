"""Firestore storage adapter for trails."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from app.functions.firestore_client import get_collection
from app.functions.trail_models import Trail, TrailDetails

if TYPE_CHECKING:
    from google.cloud.firestore_v1 import DocumentSnapshot  # pragma: no cover


def get_all_trails() -> list[Trail]:
    """Get all trails from Firestore.

    Returns:
        List of Trail objects with simplified coordinates for map display
    """
    print("[Firestore] Loading all trails...")
    collection = get_collection("trails")
    docs = collection.stream()

    trails = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            trails.append(Trail.from_dict(data))

    print(f"[Firestore] Loaded {len(trails)} trails")
    return trails


def get_trail_details(trail_id: str) -> TrailDetails | None:
    """Get detailed trail data for a specific trail.

    Args:
        trail_id: Unique identifier for the trail

    Returns:
        TrailDetails object with full coordinates, or None if not found
    """

    collection = get_collection("trail_details")
    doc: DocumentSnapshot = collection.document(trail_id).get()  # type: ignore[assignment]

    if doc.exists is False:
        return None

    data = doc.to_dict()
    return TrailDetails.from_dict(data) if data else None


def save_trail(trail: Trail) -> None:
    """Save or update a trail in Firestore.

    Args:
        trail: Trail object to save
    """
    print(f"[Firestore] Saving trail: {trail.name} (ID: {trail.trail_id}, Source: {trail.source})")
    collection = get_collection("trails")
    trail.last_updated = datetime.now(UTC).isoformat()
    trail_dict = trail.to_dict()

    collection.document(trail.trail_id).set(trail_dict)
    print(f"[Firestore] Saved trail: {trail.name}")


def save_trail_details(details: TrailDetails) -> None:
    """Save or update trail details in Firestore.

    Args:
        details: TrailDetails object to save
    """
    print(f"[Firestore] Saving trail details for: {details.trail_id}")
    collection = get_collection("trail_details")
    details_dict = details.to_dict()
    collection.document(details.trail_id).set(details_dict)
    print(f"[Firestore] Saved trail details for: {details.trail_id}")


def update_trail_status(trail_id: str, status: str) -> None:
    """Update the status of a trail.

    Args:
        trail_id: Unique identifier for the trail
        status: New status ("To Explore" | "Explored!")
    """
    print(f"[Firestore] Updating trail {trail_id} status to: {status}")
    collection = get_collection("trails")
    collection.document(trail_id).update({"status": status, "last_updated": datetime.now(UTC).isoformat()})
    print(f"[Firestore] Updated trail {trail_id} status")


def update_trail_name(trail_id: str, name: str) -> None:
    """Update the name of a trail.

    Args:
        trail_id: Unique identifier for the trail
        name: New name for the trail
    """
    print(f"[Firestore] Updating trail {trail_id} name to: {name}")
    collection = get_collection("trails")
    collection.document(trail_id).update({"name": name, "last_updated": datetime.now(UTC).isoformat()})
    print(f"[Firestore] Updated trail {trail_id} name")


def update_trail(trail_id: str, updates: dict) -> None:
    """Update multiple fields of a trail.

    Args:
        trail_id: Unique identifier for the trail
        updates: Dictionary of field names and values to update
    """
    print(f"[Firestore] Updating trail {trail_id} with fields: {list(updates.keys())}")
    collection = get_collection("trails")
    updates["last_updated"] = datetime.now(UTC).isoformat()
    collection.document(trail_id).update(updates)
    print(f"[Firestore] Updated trail {trail_id}")


def delete_trail(trail_id: str) -> None:
    """Delete a trail and its details from Firestore.

    Args:
        trail_id: Unique identifier for the trail
    """
    # Delete from both collections
    get_collection("trails").document(trail_id).delete()
    get_collection("trail_details").document(trail_id).delete()
