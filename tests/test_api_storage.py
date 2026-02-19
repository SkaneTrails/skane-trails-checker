"""Tests for foraging and places storage layer (doc-to-model conversion)."""

from api.storage.foraging_storage import _doc_to_foraging_spot
from api.storage.places_storage import _doc_to_place


class TestDocToForagingSpot:
    def test_full_document(self):
        spot = _doc_to_foraging_spot(
            "doc1",
            {
                "type": "Mushrooms",
                "lat": 56.0,
                "lng": 13.5,
                "notes": "Near the oak tree",
                "month": "Sep",
                "date": "2026-09-15",
                "created_at": "2026-09-15T10:00:00",
                "last_updated": "2026-09-15T10:00:00",
            },
        )
        assert spot.id == "doc1"
        assert spot.type == "Mushrooms"
        assert spot.lat == 56.0
        assert spot.lng == 13.5
        assert spot.notes == "Near the oak tree"
        assert spot.month == "Sep"

    def test_minimal_document(self):
        spot = _doc_to_foraging_spot("doc2", {})
        assert spot.id == "doc2"
        assert spot.type == ""
        assert spot.lat == 0.0
        assert spot.notes == ""


class TestDocToPlace:
    def test_full_document(self):
        place = _doc_to_place(
            {
                "place_id": "p1",
                "name": "Parkering Söderåsen",
                "lat": 56.05,
                "lng": 13.25,
                "categories": [
                    {"name": "Parkering", "slug": "parkering", "icon": "🅿️"},
                    {"name": "Toalett", "slug": "toalett", "icon": "🚻"},
                ],
                "address": "Skåneleden 123",
                "city": "Ljungbyhed",
                "weburl": "https://example.com",
                "source": "skaneleden",
                "last_updated": "2026-01-01T00:00:00",
            }
        )
        assert place.place_id == "p1"
        assert place.name == "Parkering Söderåsen"
        assert len(place.categories) == 2
        assert place.categories[0].slug == "parkering"
        assert place.city == "Ljungbyhed"

    def test_minimal_document(self):
        place = _doc_to_place({"place_id": "p2"})
        assert place.place_id == "p2"
        assert place.name == ""
        assert place.categories == []
        assert place.address == ""
        assert place.source == "skaneleden"

    def test_categories_with_missing_fields(self):
        place = _doc_to_place({"place_id": "p3", "categories": [{"slug": "vatten"}]})
        assert len(place.categories) == 1
        assert place.categories[0].name == ""
        assert place.categories[0].slug == "vatten"
        assert place.categories[0].icon == ""
