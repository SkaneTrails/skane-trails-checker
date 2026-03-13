"""Tests for API places storage operations.

Tests the Pydantic-model-returning API storage layer
(distinct from app/functions/ which returns dataclass Place).
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.models.place import PLACE_CATEGORIES, PlaceCategoryResponse, PlaceResponse, get_category_display
from api.storage.places_storage import (
    delete_all_places,
    delete_place,
    get_all_places,
    get_place_count,
    get_places_by_category,
    save_place,
    save_places_batch,
)


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


class TestSavePlace:
    """Tests for save_place."""

    @patch("api.storage.places_storage.datetime")
    def test_saves_place_with_timestamp(self, mock_dt, mock_collection) -> None:
        from datetime import UTC, datetime

        fixed = datetime(2026, 6, 15, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        place = PlaceResponse(
            place_id="p1",
            name="Test Place",
            lat=56.0,
            lng=13.0,
            categories=[PlaceCategoryResponse(name="Parkering", slug="parkering", icon="🅿️")],
        )

        save_place(place)

        mock_collection.document.assert_called_once_with("p1")
        saved = mock_collection.document.return_value.set.call_args[0][0]
        assert saved["place_id"] == "p1"
        assert saved["name"] == "Test Place"
        assert saved["last_updated"] == fixed.isoformat()


class TestSavePlacesBatch:
    """Tests for save_places_batch."""

    def test_saves_batch_of_places(self, mock_collection) -> None:
        with patch("api.storage.places_storage.create_batch") as mock_create_batch:
            mock_batch = MagicMock()
            mock_create_batch.return_value = mock_batch

            places = [
                PlaceResponse(place_id="p1", name="A", lat=56.0, lng=13.0),
                PlaceResponse(place_id="p2", name="B", lat=56.1, lng=13.1),
            ]

            result = save_places_batch(places)

            assert result == 2
            assert mock_batch.set.call_count == 2
            mock_batch.commit.assert_called_once()

    def test_empty_list_returns_zero(self, mock_collection) -> None:
        result = save_places_batch([])
        assert result == 0


class TestDeletePlace:
    """Tests for delete_place."""

    def test_deletes_place(self, mock_collection) -> None:
        delete_place("p1")

        mock_collection.document.assert_called_once_with("p1")
        mock_collection.document.return_value.delete.assert_called_once()


class TestDeleteAllPlaces:
    """Tests for delete_all_places."""

    def test_deletes_all_places(self, mock_collection) -> None:
        mock_doc1 = MagicMock()
        mock_doc2 = MagicMock()
        mock_collection.stream.return_value = [mock_doc1, mock_doc2]

        result = delete_all_places()

        assert result == 2
        mock_doc1.reference.delete.assert_called_once()
        mock_doc2.reference.delete.assert_called_once()

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []
        assert delete_all_places() == 0


class TestGetPlaceCount:
    """Tests for get_place_count."""

    def test_counts_places(self, mock_collection) -> None:
        mock_collection.stream.return_value = [MagicMock(), MagicMock(), MagicMock()]

        assert get_place_count() == 3

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []
        assert get_place_count() == 0


class TestPlaceResponseToDict:
    """Tests for PlaceResponse.to_dict() method."""

    def test_full_place_to_dict(self) -> None:
        place = PlaceResponse(
            place_id="p1",
            name="Test Place",
            lat=56.0,
            lng=13.0,
            categories=[PlaceCategoryResponse(name="Parkering", slug="parkering", icon="🅿️")],
            address="Street 1",
            city="Malmö",
            weburl="https://example.com",
            source="skaneleden",
            last_updated="2026-01-01",
        )

        result = place.to_dict()

        assert result["place_id"] == "p1"
        assert result["categories"] == [{"name": "Parkering", "slug": "parkering", "icon": "🅿️"}]
        assert result["city"] == "Malmö"

    def test_category_slugs_property(self) -> None:
        place = PlaceResponse(
            place_id="p1",
            name="T",
            lat=0,
            lng=0,
            categories=[
                PlaceCategoryResponse(name="A", slug="parkering", icon=""),
                PlaceCategoryResponse(name="B", slug="toalett", icon=""),
            ],
        )

        assert place.category_slugs == ["parkering", "toalett"]
        assert place.category_names == ["A", "B"]


class TestPlaceCategoryHelpers:
    """Tests for PLACE_CATEGORIES and get_category_display."""

    def test_place_categories_dict(self) -> None:
        assert "parkering" in PLACE_CATEGORIES
        assert PLACE_CATEGORIES["parkering"]["name"] == "Parkering"
        assert PLACE_CATEGORIES["parkering"]["icon"] == "🅿️"

    def test_get_category_display_known(self) -> None:
        result = get_category_display("parkering")
        assert result["name"] == "Parkering"
        assert result["icon"] == "🅿️"

    def test_get_category_display_unknown(self) -> None:
        result = get_category_display("unknown-slug")
        assert result["name"] == "Unknown Slug"
        assert result["icon"] == "📍"
