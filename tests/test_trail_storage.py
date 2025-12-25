"""Tests for trail models and storage."""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.functions.trail_models import Trail, TrailBounds, TrailCenter, TrailDetails
from app.functions.trail_storage import (
    delete_trail,
    get_all_trails,
    get_trail_details,
    save_trail,
    save_trail_details,
    update_trail_status,
)


@pytest.fixture
def mock_firestore_collection() -> Generator:
    """Mock Firestore collection."""
    with patch("app.functions.trail_storage.get_collection") as mock_get_coll:
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        yield mock_collection


@pytest.fixture
def sample_trail() -> Trail:
    """Create a sample Trail object."""
    return Trail(
        trail_id="skaneleden_1",
        name="Skåneleden Etapp 1",
        difficulty="Medium",
        length_km=15.5,
        status="To Explore",
        coordinates_map=[(56.0, 13.0), (56.1, 13.1), (56.2, 13.2)],
        bounds=TrailBounds(north=56.2, south=56.0, east=13.2, west=13.0),
        center=TrailCenter(lat=56.1, lng=13.1),
        source="skaneleden",
        last_updated="2025-01-15T10:00:00+00:00",
    )


@pytest.fixture
def sample_trail_details() -> TrailDetails:
    """Create a sample TrailDetails object."""
    return TrailDetails(
        trail_id="skaneleden_1",
        coordinates_full=[(56.0, 13.0), (56.05, 13.05), (56.1, 13.1), (56.15, 13.15), (56.2, 13.2)],
        elevation_profile=[100.0, 120.0, 110.0, 130.0, 105.0],
        waypoints=[{"name": "Start", "lat": 56.0, "lng": 13.0}, {"name": "End", "lat": 56.2, "lng": 13.2}],
        statistics={"total_ascent": 50.0, "total_descent": 45.0},
    )


class TestTrailBounds:
    """Tests for TrailBounds dataclass."""

    def test_trail_bounds_creation(self) -> None:
        """Test creating TrailBounds."""
        bounds = TrailBounds(north=56.5, south=56.0, east=13.5, west=13.0)

        assert bounds.north == 56.5
        assert bounds.south == 56.0
        assert bounds.east == 13.5
        assert bounds.west == 13.0


class TestTrailCenter:
    """Tests for TrailCenter dataclass."""

    def test_trail_center_creation(self) -> None:
        """Test creating TrailCenter."""
        center = TrailCenter(lat=56.25, lng=13.25)

        assert center.lat == 56.25
        assert center.lng == 13.25


class TestTrail:
    """Tests for Trail dataclass."""

    def test_trail_creation(self, sample_trail) -> None:
        """Test creating a Trail object."""
        assert sample_trail.trail_id == "skaneleden_1"
        assert sample_trail.name == "Skåneleden Etapp 1"
        assert sample_trail.difficulty == "Medium"
        assert sample_trail.length_km == 15.5
        assert sample_trail.status == "To Explore"
        assert len(sample_trail.coordinates_map) == 3
        assert sample_trail.source == "skaneleden"

    def test_trail_to_dict(self, sample_trail) -> None:
        """Test converting Trail to dictionary."""
        trail_dict = sample_trail.to_dict()

        assert trail_dict["trail_id"] == "skaneleden_1"
        assert trail_dict["name"] == "Skåneleden Etapp 1"
        assert trail_dict["bounds"]["north"] == 56.2
        assert trail_dict["center"]["lat"] == 56.1
        assert isinstance(trail_dict["coordinates_map"], list)

    def test_trail_from_dict(self) -> None:
        """Test creating Trail from dictionary."""
        data = {
            "trail_id": "test_trail",
            "name": "Test Trail",
            "difficulty": "Easy",
            "length_km": 10.0,
            "status": "Explored!",
            "coordinates_map": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}],
            "bounds": {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0},
            "center": {"lat": 56.05, "lng": 13.05},
            "source": "other_trails",
            "last_updated": "2025-01-20T12:00:00+00:00",
        }

        trail = Trail.from_dict(data)

        assert trail.trail_id == "test_trail"
        assert trail.name == "Test Trail"
        assert trail.bounds.north == 56.1
        assert trail.center.lat == 56.05
        assert trail.coordinates_map == [(56.0, 13.0), (56.1, 13.1)]

    def test_trail_roundtrip_serialization(self, sample_trail) -> None:
        """Test that Trail can be serialized and deserialized."""
        trail_dict = sample_trail.to_dict()
        restored_trail = Trail.from_dict(trail_dict)

        assert restored_trail.trail_id == sample_trail.trail_id
        assert restored_trail.name == sample_trail.name
        assert restored_trail.coordinates_map == sample_trail.coordinates_map
        assert restored_trail.bounds.north == sample_trail.bounds.north


class TestTrailDetails:
    """Tests for TrailDetails dataclass."""

    def test_trail_details_creation(self, sample_trail_details) -> None:
        """Test creating a TrailDetails object."""
        assert sample_trail_details.trail_id == "skaneleden_1"
        assert len(sample_trail_details.coordinates_full) == 5
        assert sample_trail_details.elevation_profile is not None
        assert len(sample_trail_details.waypoints) == 2

    def test_trail_details_to_dict(self, sample_trail_details) -> None:
        """Test converting TrailDetails to dictionary."""
        details_dict = sample_trail_details.to_dict()

        assert details_dict["trail_id"] == "skaneleden_1"
        assert len(details_dict["coordinates_full"]) == 5
        assert details_dict["elevation_profile"] is not None
        assert details_dict["waypoints"] is not None

    def test_trail_details_from_dict(self) -> None:
        """Test creating TrailDetails from dictionary."""
        data = {
            "trail_id": "test_trail",
            "coordinates_full": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}, {"lat": 56.2, "lng": 13.2}],
            "elevation_profile": [100.0, 110.0, 105.0],
            "waypoints": [{"name": "Point 1", "lat": 56.0, "lng": 13.0}],
            "statistics": {"distance": 20.0},
        }

        details = TrailDetails.from_dict(data)

        assert details.trail_id == "test_trail"
        assert len(details.coordinates_full) == 3
        assert details.elevation_profile == [100.0, 110.0, 105.0]

    def test_trail_details_minimal(self) -> None:
        """Test TrailDetails with only required fields."""
        details = TrailDetails(trail_id="minimal_trail", coordinates_full=[(56.0, 13.0), (56.1, 13.1)])

        assert details.trail_id == "minimal_trail"
        assert details.elevation_profile is None
        assert details.waypoints is None
        assert details.statistics is None


class TestGetAllTrails:
    """Tests for get_all_trails function."""

    def test_get_all_trails_empty(self, mock_firestore_collection) -> None:
        """Test getting trails when collection is empty."""
        mock_firestore_collection.stream.return_value = []

        trails = get_all_trails()

        assert trails == []
        mock_firestore_collection.stream.assert_called_once()

    def test_get_all_trails_with_data(self, mock_firestore_collection) -> None:
        """Test getting trails with data."""
        mock_doc1 = MagicMock()
        mock_doc1.to_dict.return_value = {
            "trail_id": "trail1",
            "name": "Trail 1",
            "difficulty": "Easy",
            "length_km": 10.0,
            "status": "To Explore",
            "coordinates_map": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}],
            "bounds": {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0},
            "center": {"lat": 56.05, "lng": 13.05},
            "source": "skaneleden",
            "last_updated": "2025-01-15T10:00:00+00:00",
        }

        mock_doc2 = MagicMock()
        mock_doc2.to_dict.return_value = {
            "trail_id": "trail2",
            "name": "Trail 2",
            "difficulty": "Hard",
            "length_km": 20.0,
            "status": "Explored!",
            "coordinates_map": [{"lat": 57.0, "lng": 14.0}, {"lat": 57.1, "lng": 14.1}],
            "bounds": {"north": 57.1, "south": 57.0, "east": 14.1, "west": 14.0},
            "center": {"lat": 57.05, "lng": 14.05},
            "source": "other_trails",
            "last_updated": "2025-01-20T12:00:00+00:00",
        }

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        trails = get_all_trails()

        assert len(trails) == 2
        assert trails[0].trail_id == "trail1"
        assert trails[1].trail_id == "trail2"

    def test_get_all_trails_skips_none_data(self, mock_firestore_collection) -> None:
        """Test that None documents are skipped."""
        mock_doc1 = MagicMock()
        mock_doc1.to_dict.return_value = None

        mock_doc2 = MagicMock()
        mock_doc2.to_dict.return_value = {
            "trail_id": "trail2",
            "name": "Trail 2",
            "difficulty": "Easy",
            "length_km": 5.0,
            "status": "To Explore",
            "coordinates_map": [{"lat": 56.0, "lng": 13.0}],
            "bounds": {"north": 56.0, "south": 56.0, "east": 13.0, "west": 13.0},
            "center": {"lat": 56.0, "lng": 13.0},
            "source": "skaneleden",
            "last_updated": "2025-01-15T10:00:00+00:00",
        }

        mock_firestore_collection.stream.return_value = [mock_doc1, mock_doc2]

        trails = get_all_trails()

        assert len(trails) == 1
        assert trails[0].trail_id == "trail2"


class TestGetTrailDetails:
    """Tests for get_trail_details function."""

    def test_get_trail_details_exists(self, mock_firestore_collection) -> None:
        """Test getting trail details that exist."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "trail_id": "trail1",
            "coordinates_full": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}, {"lat": 56.2, "lng": 13.2}],
            "elevation_profile": [100.0, 110.0, 105.0],
            "waypoints": None,
            "statistics": None,
        }

        mock_firestore_collection.document.return_value.get.return_value = mock_doc

        details = get_trail_details("trail1")

        assert details is not None
        assert details.trail_id == "trail1"
        assert len(details.coordinates_full) == 3

    def test_get_trail_details_not_found(self, mock_firestore_collection) -> None:
        """Test getting trail details that don't exist."""
        mock_doc = MagicMock()
        mock_doc.exists = False

        mock_firestore_collection.document.return_value.get.return_value = mock_doc

        details = get_trail_details("nonexistent_trail")

        assert details is None

    def test_get_trail_details_none_data(self, mock_firestore_collection) -> None:
        """Test getting trail details with None data."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = None

        mock_firestore_collection.document.return_value.get.return_value = mock_doc

        details = get_trail_details("trail1")

        assert details is None


class TestSaveTrail:
    """Tests for save_trail function."""

    @patch("app.functions.trail_storage.datetime")
    def test_save_trail(self, mock_datetime, mock_firestore_collection, sample_trail) -> None:
        """Test saving a trail."""
        fixed_time = datetime(2025, 1, 20, 15, 30, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        save_trail(sample_trail)

        mock_firestore_collection.document.assert_called_once_with("skaneleden_1")
        assert mock_firestore_collection.document.return_value.set.called

    def test_save_trail_updates_timestamp(self, mock_firestore_collection, sample_trail) -> None:
        """Test that save_trail updates the last_updated timestamp."""
        original_timestamp = sample_trail.last_updated

        save_trail(sample_trail)

        # Timestamp should be updated
        assert sample_trail.last_updated != original_timestamp


class TestSaveTrailDetails:
    """Tests for save_trail_details function."""

    def test_save_trail_details(self, mock_firestore_collection, sample_trail_details) -> None:
        """Test saving trail details."""
        save_trail_details(sample_trail_details)

        mock_firestore_collection.document.assert_called_once_with("skaneleden_1")
        mock_firestore_collection.document.return_value.set.assert_called_once()


class TestUpdateTrailStatus:
    """Tests for update_trail_status function."""

    @patch("app.functions.trail_storage.datetime")
    def test_update_trail_status(self, mock_datetime, mock_firestore_collection) -> None:
        """Test updating trail status."""
        fixed_time = datetime(2025, 1, 20, 16, 0, 0, tzinfo=UTC)
        mock_datetime.now.return_value = fixed_time

        update_trail_status("trail1", "Explored!")

        mock_firestore_collection.document.assert_called_once_with("trail1")
        mock_firestore_collection.document.return_value.update.assert_called_once_with(
            {"status": "Explored!", "last_updated": fixed_time.isoformat()}
        )


class TestDeleteTrail:
    """Tests for delete_trail function."""

    @patch("app.functions.trail_storage.get_collection")
    def test_delete_trail(self, mock_get_collection) -> None:
        """Test deleting a trail."""
        mock_trails_collection = MagicMock()
        mock_details_collection = MagicMock()

        def get_collection_side_effect(name):  # noqa: ANN202
            if name == "trails":
                return mock_trails_collection
            if name == "trail_details":
                return mock_details_collection
            return MagicMock()

        mock_get_collection.side_effect = get_collection_side_effect

        delete_trail("trail1")

        mock_trails_collection.document.assert_called_once_with("trail1")
        mock_trails_collection.document.return_value.delete.assert_called_once()

        mock_details_collection.document.assert_called_once_with("trail1")
        mock_details_collection.document.return_value.delete.assert_called_once()
