"""Tests for API places storage operations.

Tests the Pydantic-model-returning API storage layer
(distinct from app/functions/ which returns dataclass Place).
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.models.place import PlaceCategoryResponse, PlaceResponse
from api.storage.places_storage import get_all_places, get_places_by_category


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    """Mock Firestore collection for API places storage."""
    with patch("api.storage.places_storage.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _make_doc(data: dict | None) -> MagicMock:
    doc = MagicMock()
    doc.to_dict.return_value = data
    return doc


SAMPLE_PLACE = {
    "place_id": "p1",
    "name": "Söderåsen Parkering",
    "lat": 56.05,
    "lng": 13.27,
    "categories": [{"name": "Parkering", "slug": "parkering", "icon": "🅿️"}],
    "address": "Skåneleden 123",
    "city": "Ljungbyhed",
    "weburl": "https://example.com",
    "source": "skaneleden",
    "last_updated": "2026-01-01T00:00:00Z",
}


class TestDocToPlace:
    """Tests for _doc_to_place conversion (via get_all_places)."""

    def test_full_document(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc(SAMPLE_PLACE)]

        result = get_all_places()

        assert len(result) == 1
        place = result[0]
        assert isinstance(place, PlaceResponse)
        assert place.place_id == "p1"
        assert place.name == "Söderåsen Parkering"
        assert place.lat == 56.05
        assert place.lng == 13.27
        assert len(place.categories) == 1
        cat = place.categories[0]
        assert isinstance(cat, PlaceCategoryResponse)
        assert cat.slug == "parkering"
        assert cat.icon == "🅿️"
        assert place.city == "Ljungbyhed"
        assert place.weburl == "https://example.com"

    def test_minimal_document_fills_defaults(self, mock_collection) -> None:
        """Place with only required field should populate defaults."""
        mock_collection.stream.return_value = [_make_doc({"place_id": "p2"})]

        result = get_all_places()

        place = result[0]
        assert place.place_id == "p2"
        assert place.name == ""
        assert place.lat == 0.0
        assert place.lng == 0.0
        assert place.categories == []
        assert place.source == "skaneleden"

    def test_multiple_categories(self, mock_collection) -> None:
        data = {
            "place_id": "p3",
            "categories": [
                {"name": "Parkering", "slug": "parkering", "icon": "🅿️"},
                {"name": "Toalett", "slug": "toalett", "icon": "🚻"},
            ],
        }
        mock_collection.stream.return_value = [_make_doc(data)]

        place = get_all_places()[0]

        assert len(place.categories) == 2
        assert place.categories[1].slug == "toalett"


class TestGetAllPlaces:
    """Tests for get_all_places."""

    def test_returns_multiple_places(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc({"place_id": "p1", "name": "Place A"}),
            _make_doc({"place_id": "p2", "name": "Place B"}),
        ]

        result = get_all_places()

        assert len(result) == 2
        assert result[0].place_id == "p1"
        assert result[1].place_id == "p2"

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []

        assert get_all_places() == []

    def test_skips_none_documents(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc({"place_id": "p1"}), _make_doc(None)]

        assert len(get_all_places()) == 1


class TestGetPlacesByCategory:
    """Tests for get_places_by_category."""

    def test_filters_by_category_slug(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _make_doc({"place_id": "p1", "categories": [{"name": "Parkering", "slug": "parkering", "icon": "🅿️"}]})
        ]

        result = get_places_by_category("parkering")

        assert len(result) == 1
        assert result[0].place_id == "p1"
        mock_collection.where.assert_called_once_with("categories", "array_contains", {"slug": "parkering"})

    def test_empty_result(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = []

        assert get_places_by_category("nonexistent") == []

    def test_skips_none_documents(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [_make_doc({"place_id": "p1"}), _make_doc(None)]

        assert len(get_places_by_category("parkering")) == 1
