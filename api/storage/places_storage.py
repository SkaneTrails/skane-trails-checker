"""Firestore storage operations for places/POIs."""

import logging

from api.models.place import PlaceCategoryResponse, PlaceResponse
from api.storage.firestore_client import get_collection

logger = logging.getLogger(__name__)


def _doc_to_place(data: dict) -> PlaceResponse:
    """Convert a Firestore document dict to a PlaceResponse model."""
    return PlaceResponse(
        place_id=data["place_id"],
        name=data.get("name", ""),
        lat=data.get("lat", 0.0),
        lng=data.get("lng", 0.0),
        categories=[
            PlaceCategoryResponse(name=cat.get("name", ""), slug=cat.get("slug", ""), icon=cat.get("icon", ""))
            for cat in data.get("categories", [])
        ],
        address=data.get("address", ""),
        city=data.get("city", ""),
        weburl=data.get("weburl", ""),
        source=data.get("source", "skaneleden"),
        last_updated=data.get("last_updated", ""),
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
