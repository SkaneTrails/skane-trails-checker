"""Firestore storage adapter for foraging data."""

from datetime import UTC, datetime

from functions.firestore_client import get_collection


def get_foraging_spots(month: str | None = None) -> list[dict]:
    """Get foraging spots from Firestore.

    Args:
        month: Optional month filter (e.g., "Jan", "Feb"). If None, returns all spots.

    Returns:
        List of foraging spot dictionaries with 'id' field included
    """
    collection = get_collection("foraging_spots")

    # Filter by month if specified, otherwise get all spots
    docs = collection.where("month", "==", month).stream() if month else collection.stream()

    spots = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            data["id"] = doc.id  # Include document ID for updates/deletes
            spots.append(data)

    return spots


def save_foraging_spot(spot_data: dict) -> str:
    """Save a foraging spot to Firestore.

    Args:
        spot_data: Dictionary with keys: type, lat, lng, notes, month

    Returns:
        Document ID of the saved spot
    """
    collection = get_collection("foraging_spots")

    # Add timestamp
    spot_data["created_at"] = datetime.now(UTC).isoformat()
    spot_data["last_updated"] = datetime.now(UTC).isoformat()

    # Auto-generate ID
    doc_ref = collection.document()
    doc_ref.set(spot_data)

    return doc_ref.id


def update_foraging_spot(spot_id: str, spot_data: dict) -> None:
    """Update a foraging spot in Firestore.

    Args:
        spot_id: Document ID of the spot
        spot_data: Dictionary with updated fields
    """
    collection = get_collection("foraging_spots")

    # Update timestamp
    spot_data["last_updated"] = datetime.now(UTC).isoformat()

    collection.document(spot_id).update(spot_data)


def delete_foraging_spot(spot_id: str) -> None:
    """Delete a foraging spot from Firestore.

    Args:
        spot_id: Document ID of the spot
    """
    collection = get_collection("foraging_spots")
    collection.document(spot_id).delete()


def get_foraging_types() -> dict[str, dict]:
    """Get foraging types from Firestore.

    Returns:
        Dictionary mapping type names to their properties (icon, etc.)
    """
    collection = get_collection("foraging_types")
    docs = collection.stream()

    types = {}
    for doc in docs:
        data = doc.to_dict()
        if data:
            types[doc.id] = data

    return types


def save_foraging_type(type_name: str, type_data: dict) -> None:
    """Save or update a foraging type in Firestore.

    Args:
        type_name: Name of the foraging type (used as document ID)
        type_data: Dictionary with type properties (icon, etc.)
    """
    collection = get_collection("foraging_types")
    collection.document(type_name).set(type_data)


def delete_foraging_type(type_name: str) -> None:
    """Delete a foraging type from Firestore.

    Args:
        type_name: Name of the foraging type
    """
    collection = get_collection("foraging_types")
    collection.document(type_name).delete()
