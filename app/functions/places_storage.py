"""Firestore storage adapter for places/POIs."""

from datetime import UTC, datetime

from app.functions.firestore_client import get_collection
from app.functions.place_models import Place


def get_all_places() -> list[Place]:
    """Get all places from Firestore.

    Returns:
        List of Place objects for map display
    """
    print("[Firestore] Loading all places...")
    collection = get_collection("places")
    docs = collection.stream()

    places = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            places.append(Place.from_dict(data))

    print(f"[Firestore] Loaded {len(places)} places")
    return places


def get_places_by_category(category_slug: str) -> list[Place]:
    """Get places filtered by category.

    Args:
        category_slug: Category slug to filter by (e.g., 'parkering', 'vatten')

    Returns:
        List of Place objects matching the category
    """
    print(f"[Firestore] Loading places for category: {category_slug}")
    collection = get_collection("places")
    docs = collection.where("categories", "array_contains", {"slug": category_slug}).stream()

    places = []
    for doc in docs:
        data = doc.to_dict()
        if data:
            places.append(Place.from_dict(data))

    print(f"[Firestore] Loaded {len(places)} places for category: {category_slug}")
    return places


def save_place(place: Place) -> None:
    """Save or update a place in Firestore.

    Args:
        place: Place object to save
    """
    collection = get_collection("places")
    place.last_updated = datetime.now(UTC).isoformat()
    place_dict = place.to_dict()
    collection.document(place.place_id).set(place_dict)


def save_places_batch(places: list[Place], batch_size: int = 500) -> int:
    """Save multiple places in batches.

    Firestore has a limit of 500 writes per batch.

    Args:
        places: List of Place objects to save
        batch_size: Number of places per batch (max 500)

    Returns:
        Number of places saved
    """
    if not places:
        return 0

    from app.functions.firestore_client import get_firestore_client

    db = get_firestore_client()
    collection = get_collection("places")
    timestamp = datetime.now(UTC).isoformat()

    saved_count = 0

    for i in range(0, len(places), batch_size):
        batch = db.batch()
        batch_places = places[i : i + batch_size]

        for place in batch_places:
            place.last_updated = timestamp
            doc_ref = collection.document(place.place_id)
            batch.set(doc_ref, place.to_dict())

        batch.commit()
        saved_count += len(batch_places)
        print(f"[Firestore] Saved batch {i // batch_size + 1}: {saved_count}/{len(places)} places")

    print(f"[Firestore] Saved {saved_count} places total")
    return saved_count


def delete_place(place_id: str) -> None:
    """Delete a place from Firestore.

    Args:
        place_id: Unique identifier for the place
    """
    get_collection("places").document(place_id).delete()


def delete_all_places() -> int:
    """Delete all places from Firestore.

    Returns:
        Number of places deleted
    """
    print("[Firestore] Deleting all places...")
    collection = get_collection("places")
    docs = collection.stream()

    deleted_count = 0
    for doc in docs:
        doc.reference.delete()
        deleted_count += 1

    print(f"[Firestore] Deleted {deleted_count} places")
    return deleted_count


def get_place_count() -> int:
    """Get the total number of places in Firestore.

    Returns:
        Number of places
    """
    collection = get_collection("places")
    # Use count aggregation if available, otherwise stream and count
    return sum(1 for _ in collection.stream())
