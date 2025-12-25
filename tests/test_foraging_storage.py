"""Tests for foraging storage operations."""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.functions.foraging_storage import (
    delete_foraging_spot,
    delete_foraging_type,
    get_foraging_spots,
    get_foraging_types,
    save_foraging_spot,
    save_foraging_type,
    update_foraging_spot,
)


@pytest.fixture
def mock_firestore_collection() -> Generator:
    """Mock Firestore collection."""
    with patch("app.functions.foraging_storage.get_collection") as mock_get_coll:
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        yield mock_collection


@pytest.fixture
def sample_foraging_spot() -> dict:
    """Create a sample foraging spot."""
    return {
        "type": "Mushroom",
        "lat": 56.0,
        "lng": 13.0,
        "notes": "Found chanterelles here",
        "month": "Sep",
        "date": "2024-09-15",
    }


@pytest.fixture
def sample_foraging_type() -> dict:
    """Create a sample foraging type."""
    return {"icon": "🍄"}


class TestGetForagingSpots:
    """Tests for get_foraging_spots function."""

    def test_get_all_spots_no_month_filter(self, mock_firestore_collection) -> None:
        """Test getting all foraging spots without month filter."""
        mock_doc1 = MagicMock()
        mock_doc1.id = "spot1"
        mock_doc1.to_dict.return_value = {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "month": "Sep"}

        mock_doc2 = MagicMock()
        mock_doc2.id = "spot2"
        mock_doc2.to_dict.return_value = {"type": "Berry", "lat": 56.1, "lng": 13.1, "month": "Jul"}

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        spots = get_foraging_spots()

        assert len(spots) == 2
        assert spots[0]["type"] == "Mushroom"
        assert spots[1]["type"] == "Berry"
        mock_firestore_collection.stream.assert_called_once()

    def test_get_spots_with_month_filter(self, mock_firestore_collection) -> None:
        """Test getting foraging spots filtered by month."""
        mock_doc = MagicMock()
        mock_doc.id = "spot1"
        mock_doc.to_dict.return_value = {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "month": "Sep"}

        mock_firestore_collection.where.return_value.stream.return_value = [mock_doc]

        spots = get_foraging_spots(month="Sep")

        assert len(spots) == 1
        assert spots[0]["type"] == "Mushroom"
        assert spots[0]["month"] == "Sep"
        mock_firestore_collection.where.assert_called_once_with("month", "==", "Sep")

    def test_get_spots_empty_collection(self, mock_firestore_collection) -> None:
        """Test getting spots from empty collection."""
        mock_firestore_collection.stream.return_value = []

        spots = get_foraging_spots()

        assert spots == []
        mock_firestore_collection.stream.assert_called_once()

    def test_get_spots_skips_none_data(self, mock_firestore_collection) -> None:
        """Test that None documents are skipped."""
        mock_doc1 = MagicMock()
        mock_doc1.id = "spot1"
        mock_doc1.to_dict.return_value = {"type": "Mushroom", "lat": 56.0, "lng": 13.0}

        mock_doc2 = MagicMock()
        mock_doc2.id = "spot2"
        mock_doc2.to_dict.return_value = None

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        spots = get_foraging_spots()

        assert len(spots) == 1
        assert spots[0]["type"] == "Mushroom"


class TestSaveForagingSpot:
    """Tests for save_foraging_spot function."""

    @patch("app.functions.foraging_storage.datetime")
    def test_save_new_spot(self, mock_datetime, mock_firestore_collection, sample_foraging_spot) -> None:
        """Test saving a new foraging spot."""
        fixed_time = datetime(2025, 1, 20, 15, 30, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "auto_generated_id"
        mock_firestore_collection.document.return_value = mock_doc_ref

        spot_id = save_foraging_spot(sample_foraging_spot)

        # Verify document() was called (auto-generates ID)
        mock_firestore_collection.document.assert_called_once_with()
        mock_doc_ref.set.assert_called_once()

        saved_data = mock_doc_ref.set.call_args[0][0]
        assert saved_data["type"] == "Mushroom"
        assert saved_data["lat"] == 56.0
        assert saved_data["lng"] == 13.0
        assert saved_data["created_at"] == fixed_time.isoformat()
        assert saved_data["last_updated"] == fixed_time.isoformat()
        assert spot_id == "auto_generated_id"

    @patch("app.functions.foraging_storage.datetime")
    def test_save_spot_preserves_all_fields(self, mock_datetime, mock_firestore_collection) -> None:
        """Test that all spot fields are preserved."""
        fixed_time = datetime(2025, 1, 20, 15, 30, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "auto_generated_id"
        mock_firestore_collection.document.return_value = mock_doc_ref

        spot_data = {
            "type": "Berry",
            "lat": 56.5,
            "lng": 13.5,
            "notes": "Blueberries",
            "month": "Jul",
            "date": "2024-07-15",
        }

        save_foraging_spot(spot_data)

        saved_data = mock_doc_ref.set.call_args[0][0]
        assert saved_data["type"] == "Berry"
        assert saved_data["notes"] == "Blueberries"
        assert saved_data["month"] == "Jul"
        assert saved_data["date"] == "2024-07-15"


class TestUpdateForagingSpot:
    """Tests for update_foraging_spot function."""

    @patch("app.functions.foraging_storage.datetime")
    def test_update_existing_spot(self, mock_datetime, mock_firestore_collection, sample_foraging_spot) -> None:
        """Test updating an existing foraging spot."""
        fixed_time = datetime(2025, 1, 20, 16, 0, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        update_foraging_spot("spot123", sample_foraging_spot)

        mock_firestore_collection.document.assert_called_once_with("spot123")
        mock_doc = mock_firestore_collection.document.return_value
        assert mock_doc.update.called

        updated_data = mock_doc.update.call_args[0][0]
        assert updated_data["type"] == "Mushroom"
        assert updated_data["lat"] == 56.0
        assert updated_data["last_updated"] == fixed_time.isoformat()

    @patch("app.functions.foraging_storage.datetime")
    def test_update_spot_with_partial_data(self, mock_datetime, mock_firestore_collection) -> None:
        """Test updating with partial spot data."""
        fixed_time = datetime(2025, 1, 20, 16, 0, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        partial_data = {"notes": "Updated notes", "month": "Oct"}

        update_foraging_spot("spot123", partial_data)

        updated_data = mock_firestore_collection.document.return_value.update.call_args[0][0]
        assert updated_data["notes"] == "Updated notes"
        assert updated_data["month"] == "Oct"
        assert updated_data["last_updated"] == fixed_time.isoformat()


class TestDeleteForagingSpot:
    """Tests for delete_foraging_spot function."""

    def test_delete_spot(self, mock_firestore_collection) -> None:
        """Test deleting a foraging spot."""
        delete_foraging_spot("spot123")

        mock_firestore_collection.document.assert_called_once_with("spot123")
        mock_firestore_collection.document.return_value.delete.assert_called_once()


class TestGetForagingTypes:
    """Tests for get_foraging_types function."""

    def test_get_all_types(self, mock_firestore_collection) -> None:
        """Test getting all foraging types."""
        mock_doc1 = MagicMock()
        mock_doc1.id = "Mushroom"
        mock_doc1.to_dict.return_value = {"icon": "🍄"}

        mock_doc2 = MagicMock()
        mock_doc2.id = "Berry"
        mock_doc2.to_dict.return_value = {"icon": "🫐"}

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        types = get_foraging_types()

        assert len(types) == 2
        assert types["Mushroom"]["icon"] == "🍄"
        assert types["Berry"]["icon"] == "🫐"
        mock_firestore_collection.stream.assert_called_once()

    def test_get_types_empty_collection(self, mock_firestore_collection) -> None:
        """Test getting types from empty collection."""
        mock_firestore_collection.stream.return_value = []

        types = get_foraging_types()

        assert types == {}
        mock_firestore_collection.stream.assert_called_once()

    def test_get_types_skips_none_data(self, mock_firestore_collection) -> None:
        """Test that None documents are skipped."""
        mock_doc1 = MagicMock()
        mock_doc1.id = "Mushroom"
        mock_doc1.to_dict.return_value = {"icon": "🍄"}

        mock_doc2 = MagicMock()
        mock_doc2.id = "Berry"
        mock_doc2.to_dict.return_value = None

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        types = get_foraging_types()

        assert len(types) == 1
        assert "Mushroom" in types
        assert "Berry" not in types


class TestSaveForagingType:
    """Tests for save_foraging_type function."""

    def test_save_new_type(self, mock_firestore_collection, sample_foraging_type) -> None:
        """Test saving a new foraging type."""
        save_foraging_type("Mushroom", sample_foraging_type)

        mock_firestore_collection.document.assert_called_once_with("Mushroom")
        mock_doc = mock_firestore_collection.document.return_value
        mock_doc.set.assert_called_once_with(sample_foraging_type)

    def test_save_type_with_custom_icon(self, mock_firestore_collection) -> None:
        """Test saving type with custom icon."""
        type_data = {"icon": "🌰"}

        save_foraging_type("Nut", type_data)

        mock_firestore_collection.document.assert_called_once_with("Nut")
        mock_doc = mock_firestore_collection.document.return_value
        mock_doc.set.assert_called_once_with({"icon": "🌰"})


class TestDeleteForagingType:
    """Tests for delete_foraging_type function."""

    def test_delete_type(self, mock_firestore_collection) -> None:
        """Test deleting a foraging type."""
        delete_foraging_type("Mushroom")

        mock_firestore_collection.document.assert_called_once_with("Mushroom")
        mock_firestore_collection.document.return_value.delete.assert_called_once()
