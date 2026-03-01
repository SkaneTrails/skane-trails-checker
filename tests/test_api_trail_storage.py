"""Tests for API trail storage operations.

Tests the Pydantic-model-returning API storage layer
(distinct from app/functions/ which returns dataclass Trail).
"""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from api.models.trail import Coordinate, TrailBounds, TrailDetailsResponse, TrailResponse
from api.storage.trail_storage import (
    delete_trail,
    get_all_trails,
    get_trail,
    get_trail_details,
    save_trail,
    save_trail_details,
    update_trail,
    update_trail_name,
    update_trail_status,
)


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    """Mock Firestore collection for API trail storage."""
    with patch("api.storage.trail_storage.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _make_doc(data: dict | None, *, exists: bool = True) -> MagicMock:
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = data
    return doc


SAMPLE_TRAIL = {
    "trail_id": "t1",
    "name": "Söderåsen North",
    "difficulty": "medium",
    "length_km": 8.5,
    "status": "To Explore",
    "coordinates_map": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}],
    "bounds": {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0},
    "center": {"lat": 56.05, "lng": 13.05},
    "source": "other_trails",
    "last_updated": "2026-01-01T00:00:00Z",
    "activity_date": "2025-12-15",
    "activity_type": "hiking",
    "elevation_gain": 120.5,
    "elevation_loss": 115.0,
}

SAMPLE_TRAIL_DETAILS = {
    "trail_id": "t1",
    "coordinates_full": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.05, "lng": 13.05}, {"lat": 56.1, "lng": 13.1}],
    "elevation_profile": [100.0, 150.0, 120.0],
    "waypoints": [{"name": "Start", "lat": 56.0, "lng": 13.0}],
    "statistics": {"total_distance_km": 8.5},
}


class TestDocToTrail:
    """Tests for _doc_to_trail conversion (via get_all_trails)."""

    def test_full_document(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = SAMPLE_TRAIL
        mock_collection.stream.return_value = [mock_doc]

        result = get_all_trails()

        assert len(result) == 1
        trail = result[0]
        assert isinstance(trail, TrailResponse)
        assert trail.trail_id == "t1"
        assert trail.name == "Söderåsen North"
        assert trail.difficulty == "medium"
        assert trail.length_km == 8.5
        assert trail.status == "To Explore"
        assert len(trail.coordinates_map) == 2
        assert isinstance(trail.coordinates_map[0], Coordinate)
        assert trail.coordinates_map[0].lat == 56.0
        assert isinstance(trail.bounds, TrailBounds)
        assert trail.bounds.north == 56.1
        assert isinstance(trail.center, Coordinate)
        assert trail.center.lat == 56.05
        assert trail.source == "other_trails"
        assert trail.activity_date == "2025-12-15"
        assert trail.activity_type == "hiking"
        assert trail.elevation_gain == 120.5
        assert trail.elevation_loss == 115.0

    def test_minimal_document_fills_defaults(self, mock_collection) -> None:
        """Trail with only required fields should populate defaults."""
        minimal = {"trail_id": "t2", "name": "Minimal Trail"}
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = minimal
        mock_collection.stream.return_value = [mock_doc]

        trail = get_all_trails()[0]

        assert trail.trail_id == "t2"
        assert trail.difficulty == "Unknown"
        assert trail.length_km == 0.0
        assert trail.status == "To Explore"
        assert trail.coordinates_map == []
        assert trail.bounds.north == 0.0
        assert trail.center.lat == 0.0
        assert trail.source == ""
        assert trail.activity_date is None
        assert trail.activity_type is None
        assert trail.elevation_gain is None
        assert trail.elevation_loss is None


class TestGetAllTrails:
    """Tests for get_all_trails."""

    def test_returns_all_trails(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc({"trail_id": "t1", "name": "Trail A"}),
            _make_doc({"trail_id": "t2", "name": "Trail B"}),
        ]

        result = get_all_trails()

        assert len(result) == 2
        mock_collection.stream.assert_called_once()

    def test_filters_by_source(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _make_doc({"trail_id": "t1", "name": "Trail A", "source": "planned_hikes"})
        ]

        result = get_all_trails(source="planned_hikes")

        assert len(result) == 1
        mock_collection.where.assert_called_once_with("source", "==", "planned_hikes")

    def test_empty_collection(self, mock_collection) -> None:
        mock_collection.stream.return_value = []

        assert get_all_trails() == []

    def test_skips_none_documents(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Trail A"}), _make_doc(None)]

        assert len(get_all_trails()) == 1


class TestGetTrail:
    """Tests for get_trail — single trail lookup."""

    def test_returns_trail_when_found(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(SAMPLE_TRAIL)

        result = get_trail("t1")

        assert result is not None
        assert isinstance(result, TrailResponse)
        assert result.trail_id == "t1"
        mock_collection.document.assert_called_once_with("t1")

    def test_returns_none_when_not_found(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=False)

        assert get_trail("nonexistent") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=True)

        assert get_trail("empty-doc") is None


class TestGetTrailDetails:
    """Tests for get_trail_details."""

    def test_returns_details_when_found(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(SAMPLE_TRAIL_DETAILS)

        result = get_trail_details("t1")

        assert result is not None
        assert isinstance(result, TrailDetailsResponse)
        assert result.trail_id == "t1"
        assert len(result.coordinates_full) == 3
        assert result.elevation_profile == [100.0, 150.0, 120.0]
        assert result.waypoints == [{"name": "Start", "lat": 56.0, "lng": 13.0}]
        assert result.statistics == {"total_distance_km": 8.5}

    def test_returns_none_when_not_found(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=False)

        assert get_trail_details("nonexistent") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=True)

        assert get_trail_details("empty-doc") is None

    def test_minimal_details(self, mock_collection) -> None:
        """Details with only required fields fill defaults."""
        mock_collection.document.return_value.get.return_value = _make_doc({"trail_id": "t2"})

        result = get_trail_details("t2")

        assert result is not None
        assert result.coordinates_full == []
        assert result.elevation_profile is None
        assert result.waypoints is None
        assert result.statistics is None


class TestUpdateTrailStatus:
    """Tests for update_trail_status."""

    @patch("api.storage.trail_storage.datetime")
    def test_updates_status(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 12, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        update_trail_status("t1", "Explored!")

        mock_collection.document.assert_called_once_with("t1")
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["status"] == "Explored!"
        assert updated["last_updated"] == fixed.isoformat()


class TestUpdateTrailName:
    """Tests for update_trail_name."""

    @patch("api.storage.trail_storage.datetime")
    def test_updates_name(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 12, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        update_trail_name("t1", "New Name")

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["name"] == "New Name"
        assert updated["last_updated"] == fixed.isoformat()


class TestUpdateTrail:
    """Tests for update_trail — generic field update."""

    @patch("api.storage.trail_storage.datetime")
    def test_updates_multiple_fields(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 13, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        update_trail("t1", {"difficulty": "hard", "length_km": 10.0})

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["difficulty"] == "hard"
        assert updated["length_km"] == 10.0
        assert updated["last_updated"] == fixed.isoformat()

    @patch("api.storage.trail_storage.datetime")
    def test_updates_single_field(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 3, 1, 13, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        update_trail("t1", {"status": "Explored!"})

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["status"] == "Explored!"
        assert "last_updated" in updated


class TestDeleteTrail:
    """Tests for delete_trail — deletes both trail and trail_details."""

    def test_deletes_trail_and_details(self, mock_collection) -> None:
        delete_trail("t1")

        # Should call get_collection twice (trails + trail_details)
        # and delete from both
        calls = mock_collection.document.call_args_list
        assert len(calls) == 2
        assert calls[0].args == ("t1",)
        assert calls[1].args == ("t1",)


class TestSaveTrail:
    """Tests for save_trail — saves a TrailResponse to Firestore."""

    @patch("api.storage.trail_storage.datetime")
    def test_saves_trail_with_timestamp(self, mock_dt, mock_collection) -> None:
        fixed = datetime(2026, 6, 15, 10, 0, 0, tzinfo=UTC)
        mock_dt.now.return_value = fixed

        trail = TrailResponse(
            trail_id="t1",
            name="Test Trail",
            difficulty="easy",
            length_km=5.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.1, south=55.9, east=13.1, west=12.9),
            center=Coordinate(lat=56.0, lng=13.0),
            source="other_trails",
            last_updated="old-timestamp",
        )

        save_trail(trail)

        mock_collection.document.assert_called_once_with("t1")
        saved_data = mock_collection.document.return_value.set.call_args[0][0]
        assert saved_data["trail_id"] == "t1"
        assert saved_data["name"] == "Test Trail"
        assert saved_data["last_updated"] == fixed.isoformat()
        assert saved_data["coordinates_map"] == [{"lat": 56.0, "lng": 13.0}]


class TestSaveTrailDetails:
    """Tests for save_trail_details — saves TrailDetailsResponse to Firestore."""

    def test_saves_details(self, mock_collection) -> None:
        details = TrailDetailsResponse(
            trail_id="t1",
            coordinates_full=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)],
            elevation_profile=[100.0, 150.0],
        )

        save_trail_details(details)

        mock_collection.document.assert_called_once_with("t1")
        saved_data = mock_collection.document.return_value.set.call_args[0][0]
        assert saved_data["trail_id"] == "t1"
        assert len(saved_data["coordinates_full"]) == 2
        assert saved_data["elevation_profile"] == [100.0, 150.0]


class TestTrailResponseToDict:
    """Tests for TrailResponse.to_dict() method."""

    def test_full_trail_to_dict(self) -> None:
        trail = TrailResponse(
            trail_id="t1",
            name="Test Trail",
            difficulty="medium",
            length_km=10.5,
            status="Explored!",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)],
            bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
            center=Coordinate(lat=56.05, lng=13.05),
            source="other_trails",
            last_updated="2026-01-01",
            activity_date="2025-12-15",
            activity_type="hiking",
            elevation_gain=120.5,
            elevation_loss=115.0,
        )

        result = trail.to_dict()

        assert result["trail_id"] == "t1"
        assert result["coordinates_map"] == [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}]
        assert result["bounds"] == {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0}
        assert result["center"] == {"lat": 56.05, "lng": 13.05}
        assert result["activity_date"] == "2025-12-15"
        assert result["elevation_gain"] == 120.5

    def test_minimal_trail_to_dict_omits_optional_fields(self) -> None:
        trail = TrailResponse(
            trail_id="t2",
            name="Minimal",
            difficulty="easy",
            length_km=1.0,
            status="To Explore",
            coordinates_map=[],
            bounds=TrailBounds(north=0, south=0, east=0, west=0),
            center=Coordinate(lat=0, lng=0),
            source="other_trails",
            last_updated="2026-01-01",
        )

        result = trail.to_dict()

        assert "activity_date" not in result
        assert "activity_type" not in result
        assert "elevation_gain" not in result
        assert "elevation_loss" not in result


class TestTrailDetailsToDict:
    """Tests for TrailDetailsResponse.to_dict() method."""

    def test_full_details_to_dict(self) -> None:
        details = TrailDetailsResponse(
            trail_id="t1",
            coordinates_full=[Coordinate(lat=56.0, lng=13.0)],
            elevation_profile=[100.0],
            waypoints=[{"name": "Start"}],
            statistics={"total_km": 5.0},
        )

        result = details.to_dict()

        assert result["trail_id"] == "t1"
        assert result["coordinates_full"] == [{"lat": 56.0, "lng": 13.0}]
        assert result["elevation_profile"] == [100.0]
        assert result["waypoints"] == [{"name": "Start"}]
        assert result["statistics"] == {"total_km": 5.0}

    def test_minimal_details_to_dict(self) -> None:
        details = TrailDetailsResponse(trail_id="t2", coordinates_full=[])

        result = details.to_dict()

        assert result["trail_id"] == "t2"
        assert "elevation_profile" not in result
        assert "waypoints" not in result
        assert "statistics" not in result
