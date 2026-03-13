"""Firestore storage operations for foraging data."""

import logging
from datetime import UTC, datetime

from api.models.foraging import ForagingSpotResponse, ForagingTypeResponse
from api.storage.firestore_client import get_collection
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)


def _doc_to_foraging_spot(doc_id: str, data: dict) -> ForagingSpotResponse:
    """Convert a Firestore document dict to a ForagingSpotResponse model."""
    return ForagingSpotResponse(
        id=doc_id,
        type=data.get("type", ""),
        lat=data.get("lat", 0.0),
        lng=data.get("lng", 0.0),
        notes=data.get("notes", ""),
        month=data.get("month", ""),
        date=data.get("date", ""),
        created_at=data.get("created_at", ""),
        last_updated=data.get("last_updated", ""),
        created_by=data.get("created_by"),
    )


def get_foraging_spot(spot_id: str) -> ForagingSpotResponse | None:
    """Get a single foraging spot by ID."""
    validate_document_id(spot_id, field_name="spot_id")
    doc = get_collection("foraging_spots").document(spot_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return _doc_to_foraging_spot(doc.id, data) if data else None


def get_foraging_spots(month: str | None = None) -> list[ForagingSpotResponse]:
    """Get foraging spots, optionally filtered by month."""
    collection = get_collection("foraging_spots")
    docs = collection.where("month", "==", month).stream() if month else collection.stream()

    spots = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            spots.append(_doc_to_foraging_spot(doc.id, data))

    return spots


def save_foraging_spot(spot_data: dict) -> str:
    """Save a new foraging spot. Returns the document ID."""
    collection = get_collection("foraging_spots")
    now = datetime.now(UTC).isoformat()
    spot_data["created_at"] = now
    spot_data["last_updated"] = now

    doc_ref = collection.document()
    doc_ref.set(spot_data)
    return doc_ref.id


def update_foraging_spot(spot_id: str, spot_data: dict) -> None:
    """Update a foraging spot."""
    validate_document_id(spot_id, field_name="spot_id")
    spot_data["last_updated"] = datetime.now(UTC).isoformat()
    get_collection("foraging_spots").document(spot_id).update(spot_data)


def delete_foraging_spot(spot_id: str) -> None:
    """Delete a foraging spot."""
    validate_document_id(spot_id, field_name="spot_id")
    get_collection("foraging_spots").document(spot_id).delete()


def get_foraging_types() -> list[ForagingTypeResponse]:
    """Get all foraging types."""
    collection = get_collection("foraging_types")
    docs = collection.stream()

    types = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            types.append(
                ForagingTypeResponse(
                    name=doc.id,
                    icon=data.get("icon", ""),
                    color=data.get("color", ""),
                    swedish_name=data.get("swedish_name", ""),
                    description=data.get("description", ""),
                    season=data.get("season", ""),
                    usage=data.get("usage", ""),
                    image_file=data.get("image_file", ""),
                )
            )

    return types


def save_foraging_type(type_name: str, type_data: dict) -> None:
    """Save or update a foraging type."""
    validate_document_id(type_name, field_name="type_name")
    get_collection("foraging_types").document(type_name).set(type_data)


def update_foraging_type(type_name: str, updates: dict) -> None:
    """Update fields of an existing foraging type."""
    validate_document_id(type_name, field_name="type_name")
    get_collection("foraging_types").document(type_name).update(updates)


def get_foraging_type(type_name: str) -> ForagingTypeResponse | None:
    """Get a single foraging type by name."""
    validate_document_id(type_name, field_name="type_name")
    doc = get_collection("foraging_types").document(type_name).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if not data:
        return None
    return ForagingTypeResponse(
        name=doc.id,
        icon=data.get("icon", ""),
        color=data.get("color", ""),
        swedish_name=data.get("swedish_name", ""),
        description=data.get("description", ""),
        season=data.get("season", ""),
        usage=data.get("usage", ""),
        image_file=data.get("image_file", ""),
    )


def delete_foraging_type(type_name: str) -> None:
    """Delete a foraging type."""
    validate_document_id(type_name, field_name="type_name")
    get_collection("foraging_types").document(type_name).delete()
