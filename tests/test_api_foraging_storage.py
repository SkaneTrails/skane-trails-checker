"""Tests for API foraging storage operations.

Tests the Pydantic-model-returning API storage layer
(distinct from app/functions/ which returns dicts).
"""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from api.models.foraging import ForagingSpotResponse, ForagingTypeResponse
from api.storage.foraging_storage import (
    delete_foraging_spot,
    delete_foraging_type,
    get_foraging_spot,
    get_foraging_spots,
    get_foraging_type,
    get_foraging_types,
    save_foraging_spot,
    save_foraging_type,
    update_foraging_spot,
    update_foraging_type,
)
from api.storage.validation import InvalidDocumentIdError


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    """Mock Firestore collection for API storage."""
    with patch("api.storage.foraging_storage.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _make_doc(doc_id: str, data: dict | None) -> MagicMock:
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = data
    return doc


class TestGetForagingSpot:
    """Tests for get_foraging_spot — returns single ForagingSpotResponse."""

    def test_returns_spot_by_id(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "s1"
        mock_doc.to_dict.return_value = {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "created_by": "user-1"}
        mock_collection.document.return_value.get.return_value = mock_doc

        result = get_foraging_spot("s1")

        assert result is not None
        assert isinstance(result, ForagingSpotResponse)
        assert result.id == "s1"
        assert result.type == "Mushroom"
        assert result.created_by == "user-1"
        mock_collection.document.assert_called_once_with("s1")

    def test_returns_none_when_not_found(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_collection.document.return_value.get.return_value = mock_doc

        assert get_foraging_spot("nonexistent") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = None
        mock_collection.document.return_value.get.return_value = mock_doc

        assert get_foraging_spot("bad-doc") is None

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="spot_id"):
            get_foraging_spot("")


class TestGetForagingSpots:
    """Tests for get_foraging_spots — returns ForagingSpotResponse models."""

    def test_returns_all_spots(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "month": "Sep"}),
            _make_doc("s2", {"type": "Berry", "lat": 56.1, "lng": 13.1, "month": "Jul"}),
        ]

        result = get_foraging_spots()

        assert len(result) == 2
        assert all(isinstance(s, ForagingSpotResponse) for s in result)
        assert result[0].id == "s1"
        assert result[0].type == "Mushroom"
        assert result[1].id == "s2"
        mock_collection.stream.assert_called_once()

    def test_filters_by_month(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "month": "Sep"})
        ]

        result = get_foraging_spots(month="Sep")

        assert len(result) == 1
        assert result[0].month == "Sep"
        mock_collection.where.assert_called_once_with("month", "==", "Sep")

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []

        assert get_foraging_spots() == []

    def test_skips_none_documents(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0}),
            _make_doc("s2", None),
        ]

        result = get_foraging_spots()

        assert len(result) == 1

    def test_default_field_values(self, mock_collection) -> None:
        """Minimal document should fill defaults for missing fields."""
        mock_collection.stream.return_value = [_make_doc("s1", {"type": "Unknown"})]

        result = get_foraging_spots()

        spot = result[0]
        assert spot.type == "Unknown"
        assert spot.lat == 0.0
        assert spot.lng == 0.0
        assert spot.notes == ""
        assert spot.month == ""

    def test_maps_created_by(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "created_by": "user-1"})
        ]

        result = get_foraging_spots()

        assert result[0].created_by == "user-1"

    def test_filters_by_group_id(self, mock_collection) -> None:
        """When group_id is provided, only return spots for that group."""
        mock_collection.where.return_value.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "group_id": "grp-1"})
        ]

        result = get_foraging_spots(group_id="grp-1")

        assert len(result) == 1
        assert result[0].group_id == "grp-1"
        mock_collection.where.assert_called_once_with("group_id", "==", "grp-1")

    def test_filters_by_group_and_month(self, mock_collection) -> None:
        """Group + month filtering chains two where clauses."""
        query = MagicMock()
        mock_collection.where.return_value = query
        query.where.return_value.stream.return_value = [
            _make_doc("s1", {"type": "Berry", "lat": 56.0, "lng": 13.0, "month": "Jul", "group_id": "grp-1"})
        ]

        result = get_foraging_spots(month="Jul", group_id="grp-1")

        assert len(result) == 1
        mock_collection.where.assert_called_once_with("group_id", "==", "grp-1")
        query.where.assert_called_once_with("month", "==", "Jul")

    def test_maps_group_id(self, mock_collection) -> None:
        """group_id field is mapped from Firestore documents."""
        mock_collection.stream.return_value = [
            _make_doc("s1", {"type": "Mushroom", "lat": 56.0, "lng": 13.0, "group_id": "grp-1"})
        ]

        result = get_foraging_spots()

        assert result[0].group_id == "grp-1"


class TestSaveForagingSpot:
    """Tests for save_foraging_spot."""

    @patch("api.storage.foraging_storage.datetime")
    def test_saves_and_returns_id(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 12, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        mock_doc = MagicMock()
        mock_doc.id = "new-id"
        mock_collection.document.return_value = mock_doc

        result = save_foraging_spot({"type": "Mushroom", "lat": 56.0, "lng": 13.0})

        assert result == "new-id"
        mock_collection.document.assert_called_once_with()
        saved = mock_doc.set.call_args[0][0]
        assert saved["created_at"] == fixed.isoformat()
        assert saved["last_updated"] == fixed.isoformat()
        assert saved["type"] == "Mushroom"


class TestUpdateForagingSpot:
    """Tests for update_foraging_spot."""

    @patch("api.storage.foraging_storage.datetime")
    def test_updates_with_timestamp(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 13, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        update_foraging_spot("spot-1", {"notes": "Updated"})

        mock_collection.document.assert_called_once_with("spot-1")
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["notes"] == "Updated"
        assert updated["last_updated"] == fixed.isoformat()


class TestDeleteForagingSpot:
    """Tests for delete_foraging_spot."""

    def test_deletes_by_id(self, mock_collection) -> None:
        delete_foraging_spot("spot-1")

        mock_collection.document.assert_called_once_with("spot-1")
        mock_collection.document.return_value.delete.assert_called_once()


class TestGetForagingTypes:
    """Tests for get_foraging_types — returns ForagingTypeResponse models."""

    def test_returns_all_types(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc("Mushroom", {"icon": "🍄", "color": "#8B4513"}),
            _make_doc("Berry", {"icon": "🫐", "color": ""}),
        ]

        result = get_foraging_types()

        assert len(result) == 2
        assert all(isinstance(t, ForagingTypeResponse) for t in result)
        assert result[0].name == "Mushroom"
        assert result[0].icon == "🍄"
        assert result[0].color == "#8B4513"

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []

        assert get_foraging_types() == []

    def test_skips_none_documents(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("Mushroom", {"icon": "🍄"}), _make_doc("Bad", None)]

        assert len(get_foraging_types()) == 1


class TestSaveForagingType:
    """Tests for save_foraging_type."""

    def test_saves_type(self, mock_collection) -> None:
        save_foraging_type("Mushroom", {"icon": "🍄"})

        mock_collection.document.assert_called_once_with("Mushroom")
        mock_collection.document.return_value.set.assert_called_once_with({"icon": "🍄"})


class TestUpdateForagingType:
    """Tests for update_foraging_type."""

    def test_updates_type(self, mock_collection) -> None:
        update_foraging_type("Mushroom", {"color": "#FF0000"})

        mock_collection.document.assert_called_once_with("Mushroom")
        mock_collection.document.return_value.update.assert_called_once_with({"color": "#FF0000"})

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="type_name"):
            update_foraging_type("", {"color": "#FF0000"})


class TestGetForagingType:
    """Tests for get_foraging_type — returns single ForagingTypeResponse."""

    def test_returns_type_by_name(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "Mushroom"
        mock_doc.to_dict.return_value = {"icon": "🍄", "color": "#8B4513", "season": "Autumn"}
        mock_collection.document.return_value.get.return_value = mock_doc

        result = get_foraging_type("Mushroom")

        assert result is not None
        assert isinstance(result, ForagingTypeResponse)
        assert result.name == "Mushroom"
        assert result.icon == "🍄"
        assert result.color == "#8B4513"
        assert result.season == "Autumn"
        mock_collection.document.assert_called_once_with("Mushroom")

    def test_returns_none_when_not_found(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_collection.document.return_value.get.return_value = mock_doc

        assert get_foraging_type("Nonexistent") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = None
        mock_collection.document.return_value.get.return_value = mock_doc

        assert get_foraging_type("bad-doc") is None

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="type_name"):
            get_foraging_type("")


class TestDeleteForagingType:
    """Tests for delete_foraging_type."""

    def test_deletes_type(self, mock_collection) -> None:
        delete_foraging_type("Mushroom")

        mock_collection.document.assert_called_once_with("Mushroom")
        mock_collection.document.return_value.delete.assert_called_once()
