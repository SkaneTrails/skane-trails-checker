"""Firestore storage operations for places/POIs."""

import logging
from datetime import UTC, datetime

from api.models.place import PlaceCategoryResponse, PlaceResponse
from api.storage.firestore_client import create_batch, get_collection
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)


def _doc_to_place(data: dict) -> PlaceResponse:
    """Convert a Firestore document dict to a PlaceResponse model."""
    return PlaceResponse(
        place_id=data["place_id"],
        name=data.get("name") or "",
        lat=data.get("lat") or 0.0,
        lng=data.get("lng") or 0.0,
        categories=[
            PlaceCategoryResponse(name=cat.get("name") or "", slug=cat.get("slug") or "", icon=cat.get("icon") or "")
            for cat in data.get("categories") or []
        ],
        address=data.get("address") or "",
        city=data.get("city") or "",
        weburl=data.get("weburl") or "",
        source=data.get("source") or "skaneleden",
        last_updated=data.get("last_updated") or "",
    )


def get_all_places() -> list[PlaceResponse]:
    """Get all places from Firestore."""
    logger.info("Loading all places")
    collection = get_collection("places")
    docs = collection.stream()

    places = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            places.append(_doc_to_place(data))

    logger.info("Loaded %d places", len(places))
    return places


def get_places_by_category(category_slug: str) -> list[PlaceResponse]:
    """Get places filtered by category slug."""
    logger.info("Loading places for category: %s", category_slug)
    collection = get_collection("places")
    docs = collection.where("categories", "array_contains", {"slug": category_slug}).stream()

    places = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            places.append(_doc_to_place(data))

    logger.info("Loaded %d places for category: %s", len(places), category_slug)
    return places


def save_place(place: PlaceResponse) -> None:
    """Save or update a place in Firestore."""
    validate_document_id(place.place_id, field_name="place_id")
    place.last_updated = datetime.now(UTC).isoformat()
    get_collection("places").document(place.place_id).set(place.to_dict())


def save_places_batch(places: list[PlaceResponse], batch_size: int = 500) -> int:
    """Save multiple places in batches.

    Firestore has a limit of 500 writes per batch.
    """
    if not places:
        return 0

    collection = get_collection("places")
    timestamp = datetime.now(UTC).isoformat()

    saved_count = 0

    for i in range(0, len(places), batch_size):
        batch = create_batch()
        batch_places = places[i : i + batch_size]

        for place in batch_places:
            validate_document_id(place.place_id, field_name="place_id")
            place.last_updated = timestamp
            doc_ref = collection.document(place.place_id)
            batch.set(doc_ref, place.to_dict())

        batch.commit()
        saved_count += len(batch_places)
        logger.info("Saved batch %d: %d/%d places", i // batch_size + 1, saved_count, len(places))

    logger.info("Saved %d places total", saved_count)
    return saved_count


def delete_place(place_id: str) -> None:
    """Delete a place from Firestore."""
    validate_document_id(place_id, field_name="place_id")
    get_collection("places").document(place_id).delete()


def delete_all_places() -> int:
    """Delete all places from Firestore."""
    logger.info("Deleting all places...")
    collection = get_collection("places")
    docs = collection.stream()

    deleted_count = 0
    for doc in docs:
        doc.reference.delete()
        deleted_count += 1

    logger.info("Deleted %d places", deleted_count)
    return deleted_count


def get_place_count() -> int:
    """Get the total number of places in Firestore."""
    collection = get_collection("places")
    return sum(1 for _ in collection.stream())
