"""Tests for places storage operations."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from app.functions.place_models import Place, PlaceCategory
from app.functions.places_storage import (
    delete_all_places,
    delete_place,
    get_all_places,
    get_place_count,
    get_places_by_category,
    save_place,
    save_places_batch,
)


@pytest.fixture
def mock_firestore_collection() -> Generator:
    """Mock Firestore collection."""
    with patch("app.functions.places_storage.get_collection") as mock_get_coll:
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        yield mock_collection


@pytest.fixture
def sample_place() -> Place:
    """Create a sample Place object."""
    categories = [PlaceCategory(name="Parkering", slug="parkering", icon="🅿️")]
    return Place(
        place_id="place-1",
        name="Test Parking",
        lat=55.6050,
        lng=13.0038,
        categories=categories,
        address="Test Street 1",
        city="Malmö",
    )


class TestGetAllPlaces:
    """Tests for get_all_places function."""

    def test_get_all_places_empty(self, mock_firestore_collection) -> None:
        """Test get_all_places returns empty list when no places exist."""
        mock_firestore_collection.stream.return_value = []

        result = get_all_places()

        assert result == []
        mock_firestore_collection.stream.assert_called_once()

    def test_get_all_places_with_data(self, mock_firestore_collection) -> None:
        """Test get_all_places returns all places from Firestore."""
        mock_doc1 = MagicMock()
        mock_doc1.to_dict.return_value = {
            "place_id": "place-1",
            "name": "Parking Lot",
            "lat": 55.6,
            "lng": 13.0,
            "categories": [{"name": "Parkering", "slug": "parkering", "icon": "🅿️"}],
        }

        mock_doc2 = MagicMock()
        mock_doc2.to_dict.return_value = {
            "place_id": "place-2",
            "name": "Water Source",
            "lat": 55.7,
            "lng": 13.1,
            "categories": [{"name": "Vatten", "slug": "vatten", "icon": "💧"}],
        }

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        result = get_all_places()

        assert len(result) == 2
        assert result[0].place_id == "place-1"
        assert result[0].name == "Parking Lot"
        assert result[1].place_id == "place-2"
        assert result[1].name == "Water Source"

    def test_get_all_places_skips_none_data(self, mock_firestore_collection) -> None:
        """Test get_all_places skips documents with None data."""
        mock_doc1 = MagicMock()
        mock_doc1.to_dict.return_value = {"place_id": "place-1", "name": "Valid Place", "lat": 55.0, "lng": 13.0}

        mock_doc2 = MagicMock()
        mock_doc2.to_dict.return_value = None

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        result = get_all_places()

        assert len(result) == 1
        assert result[0].place_id == "place-1"


class TestGetPlacesByCategory:
    """Tests for get_places_by_category function."""

    def test_get_places_filtered_by_category(self, mock_firestore_collection) -> None:
        """Test get_places_by_category returns only places with matching category."""
        mock_doc1 = MagicMock()
        mock_doc1.to_dict.return_value = {
            "place_id": "place-1",
            "name": "Parking",
            "lat": 55.0,
            "lng": 13.0,
            "categories": [{"name": "Parkering", "slug": "parkering", "icon": "🅿️"}],
        }

        mock_query = MagicMock()
        mock_query.stream.return_value = [mock_doc1]
        mock_firestore_collection.where.return_value = mock_query

        result = get_places_by_category("parkering")

        assert len(result) == 1
        assert result[0].place_id == "place-1"
        mock_firestore_collection.where.assert_called_once_with("categories", "array_contains", {"slug": "parkering"})

    def test_get_places_by_category_empty(self, mock_firestore_collection) -> None:
        """Test get_places_by_category returns empty list when no matches."""
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        mock_firestore_collection.where.return_value = mock_query

        result = get_places_by_category("nonexistent")

        assert result == []


class TestSavePlace:
    """Tests for save_place function."""

    def test_save_place(self, mock_firestore_collection, sample_place) -> None:
        """Test save_place writes place to Firestore."""
        mock_doc_ref = MagicMock()
        mock_firestore_collection.document.return_value = mock_doc_ref

        save_place(sample_place)

        mock_firestore_collection.document.assert_called_once_with(sample_place.place_id)
        mock_doc_ref.set.assert_called_once()

        call_args = mock_doc_ref.set.call_args[0][0]
        assert call_args["place_id"] == "place-1"
        assert call_args["name"] == "Test Parking"
        assert call_args["lat"] == 55.6050
        assert call_args["lng"] == 13.0038
        assert "last_updated" in call_args

    def test_save_place_updates_timestamp(self, mock_firestore_collection, sample_place) -> None:
        """Test save_place updates last_updated timestamp."""
        mock_doc_ref = MagicMock()
        mock_firestore_collection.document.return_value = mock_doc_ref

        save_place(sample_place)

        call_args = mock_doc_ref.set.call_args[0][0]
        assert call_args["last_updated"] != ""
        assert len(call_args["last_updated"]) > 0


class TestSavePlacesBatch:
    """Tests for save_places_batch function."""

    def test_save_places_batch_empty_list(self, mock_firestore_collection) -> None:
        """Test save_places_batch handles empty list."""
        result = save_places_batch([])

        assert result == 0
        mock_firestore_collection.document.assert_not_called()

    def test_save_places_batch_single_place(self, mock_firestore_collection, sample_place) -> None:
        """Test save_places_batch saves single place."""
        from unittest.mock import patch

        mock_batch = MagicMock()
        mock_db = MagicMock()
        mock_db.batch.return_value = mock_batch

        with patch("app.functions.firestore_client.get_firestore_client", return_value=mock_db):
            result = save_places_batch([sample_place])

        assert result == 1
        mock_batch.set.assert_called_once()
        mock_batch.commit.assert_called_once()

    def test_save_places_batch_multiple_places(self, mock_firestore_collection) -> None:
        """Test save_places_batch saves multiple places."""
        from unittest.mock import patch

        places = [
            Place(place_id=f"place-{i}", name=f"Place {i}", lat=55.0 + i * 0.1, lng=13.0 + i * 0.1) for i in range(3)
        ]

        mock_batch = MagicMock()
        mock_db = MagicMock()
        mock_db.batch.return_value = mock_batch

        with patch("app.functions.firestore_client.get_firestore_client", return_value=mock_db):
            result = save_places_batch(places)

        assert result == 3
        assert mock_batch.set.call_count == 3
        mock_batch.commit.assert_called_once()


class TestDeletePlace:
    """Tests for delete_place function."""

    def test_delete_place(self, mock_firestore_collection) -> None:
        """Test delete_place removes place from Firestore."""
        mock_doc_ref = MagicMock()
        mock_firestore_collection.document.return_value = mock_doc_ref

        delete_place("place-1")

        mock_firestore_collection.document.assert_called_once_with("place-1")
        mock_doc_ref.delete.assert_called_once()


class TestGetPlaceCount:
    """Tests for get_place_count function."""

    def test_get_place_count_empty(self, mock_firestore_collection) -> None:
        """Test get_place_count returns 0 when no places exist."""
        mock_firestore_collection.stream.return_value = []

        result = get_place_count()

        assert result == 0

    def test_get_place_count_with_places(self, mock_firestore_collection) -> None:
        """Test get_place_count returns correct count."""
        mock_docs = [MagicMock() for _ in range(5)]
        mock_firestore_collection.stream.return_value = mock_docs

        result = get_place_count()

        assert result == 5


class TestDeleteAllPlaces:
    """Tests for delete_all_places function."""

    def test_delete_all_places_empty(self, mock_firestore_collection) -> None:
        """Test delete_all_places handles empty collection."""
        mock_firestore_collection.stream.return_value = []

        result = delete_all_places()

        assert result == 0
        mock_firestore_collection.stream.assert_called_once()

    def test_delete_all_places_with_data(self, mock_firestore_collection) -> None:
        """Test delete_all_places removes all places."""
        mock_docs = []
        for _i in range(3):
            mock_doc = MagicMock()
            mock_doc.reference = MagicMock()
            mock_docs.append(mock_doc)

        mock_firestore_collection.stream.return_value = mock_docs

        result = delete_all_places()

        assert result == 3
        for mock_doc in mock_docs:
            mock_doc.reference.delete.assert_called_once()
