"""Firestore storage adapter for trails."""

from datetime import UTC, datetime

from app.functions.firestore_client import get_collection
from app.functions.trail_models import Trail, TrailDetails


def get_all_trails() -> list[Trail]:
    """Get all trails from Firestore.

    Returns:
        List of Trail objects with simplified coordinates for map display
    """
    collection = get_collection("trails")
    docs = collection.stream()

    trails = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            trails.append(Trail.from_dict(data))

    return trails


def get_trail_details(trail_id: str) -> TrailDetails | None:
    """Get detailed trail data for a specific trail.

    Args:
        trail_id: Unique identifier for the trail

    Returns:
        TrailDetails object with full coordinates, or None if not found
    """
    collection = get_collection("trail_details")
    doc = collection.document(trail_id).get()

    if doc.exists is False:
        return None

    data = doc.to_dict()
    return TrailDetails.from_dict(data) if data else None


def save_trail(trail: Trail) -> None:
    """Save or update a trail in Firestore.

    Args:
        trail: Trail object to save
    """
    collection = get_collection("trails")
    trail.last_updated = datetime.now(UTC).isoformat()
    collection.document(trail.trail_id).set(trail.to_dict())


def save_trail_details(details: TrailDetails) -> None:
    """Save or update trail details in Firestore.

    Args:
        details: TrailDetails object to save
    """
    collection = get_collection("trail_details")
    collection.document(details.trail_id).set(details.to_dict())


def update_trail_status(trail_id: str, status: str) -> None:
    """Update the status of a trail.

    Args:
        trail_id: Unique identifier for the trail
        status: New status ("To Explore" | "Explored!")
    """
    collection = get_collection("trails")
    collection.document(trail_id).update({"status": status, "last_updated": datetime.now(UTC).isoformat()})


def delete_trail(trail_id: str) -> None:
    """Delete a trail and its details from Firestore.

    Args:
        trail_id: Unique identifier for the trail
    """
    # Delete from both collections
    get_collection("trails").document(trail_id).delete()
    get_collection("trail_details").document(trail_id).delete()
