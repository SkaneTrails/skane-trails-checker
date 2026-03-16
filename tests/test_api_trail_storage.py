"""Tests for API trail storage operations.

Tests the Pydantic-model-returning API storage layer
(distinct from app/functions/ which returns dataclass Trail).
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.models.trail import Coordinate, SyncMetadata, TrailBounds, TrailDetailsResponse, TrailResponse
from api.storage.trail_storage import (
    _update_sync_metadata,
    _utc_now_z,
    delete_trail,
    get_all_trails,
    get_sync_metadata,
    get_trail,
    get_trail_details,
    save_trail,
    save_trail_details,
    update_sync_metadata,
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
    "coordinates_map": [{"lat": 56.0, "lng": 13.0, "elevation": 100.0}, {"lat": 56.1, "lng": 13.1, "elevation": 220.5}],
    "bounds": {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0},
    "center": {"lat": 56.05, "lng": 13.05},
    "source": "other_trails",
    "last_updated": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": "2026-01-01T00:00:00Z",
    "activity_date": "2025-12-15",
    "activity_type": "hiking",
    "elevation_gain": 120.5,
    "elevation_loss": 115.0,
    "duration_minutes": 195,
    "avg_inclination_deg": 3.2,
    "max_inclination_deg": 12.5,
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
        assert trail.created_at == "2026-01-01T00:00:00Z"
        assert trail.modified_at == "2026-01-01T00:00:00Z"
        assert trail.activity_date == "2025-12-15"
        assert trail.activity_type == "hiking"
        assert trail.elevation_gain == 120.5
        assert trail.elevation_loss == 115.0
        assert trail.duration_minutes == 195
        assert trail.avg_inclination_deg == 3.2
        assert trail.max_inclination_deg == 12.5
        assert trail.coordinates_map[0].elevation == 100.0
        assert trail.coordinates_map[1].elevation == 220.5

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
        assert trail.created_at is None
        assert trail.modified_at is None
        assert trail.activity_date is None
        assert trail.activity_type is None
        assert trail.elevation_gain is None
        assert trail.elevation_loss is None
        assert trail.duration_minutes is None
        assert trail.avg_inclination_deg is None
        assert trail.max_inclination_deg is None
        assert trail.created_by is None

    def test_maps_created_by(self, mock_collection) -> None:
        doc_with_owner = {**SAMPLE_TRAIL, "created_by": "user-1"}
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = doc_with_owner
        mock_collection.stream.return_value = [mock_doc]

        trail = get_all_trails()[0]

        assert trail.created_by == "user-1"

    def test_maps_group_id(self, mock_collection) -> None:
        doc_with_group = {**SAMPLE_TRAIL, "group_id": "grp-1"}
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = doc_with_group
        mock_collection.stream.return_value = [mock_doc]

        trail = get_all_trails()[0]

        assert trail.group_id == "grp-1"

    def test_group_id_defaults_to_none(self, mock_collection) -> None:
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = SAMPLE_TRAIL  # no group_id
        mock_collection.stream.return_value = [mock_doc]

        trail = get_all_trails()[0]

        assert trail.group_id is None


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

    def test_filters_by_since(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _make_doc({"trail_id": "t1", "name": "New Trail", "created_at": "2026-03-01T12:00:00Z"})
        ]

        result = get_all_trails(since="2026-03-01T00:00:00Z")

        assert len(result) == 1
        mock_collection.where.assert_called_once_with("created_at", ">=", "2026-03-01T00:00:00Z")

    def test_filters_by_source_and_since(self, mock_collection) -> None:
        where_source = MagicMock()
        where_both = MagicMock()
        mock_collection.where.return_value = where_source
        where_source.where.return_value = where_both
        where_both.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Trail A", "source": "planned_hikes"})]

        result = get_all_trails(source="planned_hikes", since="2026-03-01T00:00:00Z")

        assert len(result) == 1
        mock_collection.where.assert_called_once_with("source", "==", "planned_hikes")
        where_source.where.assert_called_once_with("created_at", ">=", "2026-03-01T00:00:00Z")

    def test_filters_by_group_id(self, mock_collection) -> None:
        """When group_id is provided, fetches group trails + public trails."""
        group_query = MagicMock()
        public_query = MagicMock()

        # Mock collection.where to return different query objects based on args
        def where_side_effect(field, op, value) -> MagicMock:
            if field == "group_id" and value == "grp-1":
                return group_query
            if field == "group_id" and value is None:
                return public_query
            return MagicMock()

        mock_collection.where.side_effect = where_side_effect
        group_query.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Group Trail", "group_id": "grp-1"})]
        public_query.stream.return_value = [_make_doc({"trail_id": "t2", "name": "Public Trail"})]

        result = get_all_trails(group_id="grp-1")

        assert len(result) == 2
        trail_ids = {t.trail_id for t in result}
        assert trail_ids == {"t1", "t2"}

    def test_group_filter_deduplicates(self, mock_collection) -> None:
        """If a trail appears in both group and public results, it's not duplicated."""
        group_query = MagicMock()
        public_query = MagicMock()

        def where_side_effect(field, op, value) -> MagicMock:
            if field == "group_id" and value == "grp-1":
                return group_query
            if field == "group_id" and value is None:
                return public_query
            return MagicMock()

        mock_collection.where.side_effect = where_side_effect
        group_query.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Trail"})]
        public_query.stream.return_value = [
            _make_doc({"trail_id": "t1", "name": "Trail"})  # same trail_id
        ]

        result = get_all_trails(group_id="grp-1")

        assert len(result) == 1

    def test_group_filter_with_source_only(self, mock_collection) -> None:
        """Source without since chains within both group and public queries."""
        group_query = MagicMock()
        group_filtered = MagicMock()
        public_query = MagicMock()
        public_filtered = MagicMock()

        def where_side_effect(field, op, value) -> MagicMock:
            if field == "group_id" and value == "grp-1":
                return group_query
            if field == "group_id" and value is None:
                return public_query
            return MagicMock()

        mock_collection.where.side_effect = where_side_effect
        group_query.where.return_value = group_filtered
        group_filtered.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Group Trail"})]
        public_query.where.return_value = public_filtered
        public_filtered.stream.return_value = [_make_doc({"trail_id": "t2", "name": "Public Trail"})]

        result = get_all_trails(source="planned_hikes", group_id="grp-1")

        assert len(result) == 2
        group_query.where.assert_called_once_with("source", "==", "planned_hikes")
        public_query.where.assert_called_once_with("source", "==", "planned_hikes")

    def test_group_filter_with_source_and_since(self, mock_collection) -> None:
        """Source + since chains within both group and public queries."""
        group_query = MagicMock()
        group_source = MagicMock()
        group_both = MagicMock()
        public_query = MagicMock()
        public_source = MagicMock()
        public_both = MagicMock()

        def where_side_effect(field, op, value) -> MagicMock:
            if field == "group_id" and value == "grp-1":
                return group_query
            if field == "group_id" and value is None:
                return public_query
            return MagicMock()

        mock_collection.where.side_effect = where_side_effect
        group_query.where.return_value = group_source
        group_source.where.return_value = group_both
        group_both.stream.return_value = [_make_doc({"trail_id": "t1", "name": "Group Trail"})]
        public_query.where.return_value = public_source
        public_source.where.return_value = public_both
        public_both.stream.return_value = [_make_doc({"trail_id": "t2", "name": "Public Trail"})]

        result = get_all_trails(source="planned_hikes", since="2026-01-01T00:00:00Z", group_id="grp-1")

        assert len(result) == 2
        group_query.where.assert_called_once_with("source", "==", "planned_hikes")
        group_source.where.assert_called_once_with("created_at", ">=", "2026-01-01T00:00:00Z")
        public_query.where.assert_called_once_with("source", "==", "planned_hikes")
        public_source.where.assert_called_once_with("created_at", ">=", "2026-01-01T00:00:00Z")


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

    def test_updates_status(self, mock_collection) -> None:
        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-03-01T12:00:00Z"):
            update_trail_status("t1", "Explored!")

        mock_collection.document.assert_called_once_with("t1")
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["status"] == "Explored!"
        assert updated["last_updated"] == "2026-03-01T12:00:00Z"


class TestUpdateTrailName:
    """Tests for update_trail_name."""

    def test_updates_name(self, mock_collection) -> None:
        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-03-01T12:00:00Z"):
            update_trail_name("t1", "New Name")

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["name"] == "New Name"
        assert updated["last_updated"] == "2026-03-01T12:00:00Z"


class TestUpdateTrail:
    """Tests for update_trail — generic field update."""

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_updates_multiple_fields(self, mock_sync, mock_collection) -> None:
        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-03-01T13:00:00Z"):
            update_trail("t1", {"difficulty": "hard", "length_km": 10.0})

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["difficulty"] == "hard"
        assert updated["length_km"] == 10.0
        assert updated["last_updated"] == "2026-03-01T13:00:00Z"
        mock_sync.assert_called_once()

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_updates_single_field(self, mock_sync, mock_collection) -> None:
        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-03-01T13:00:00Z"):
            update_trail("t1", {"status": "Explored!"})

        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["status"] == "Explored!"
        assert "last_updated" in updated
        mock_sync.assert_called_once()


class TestDeleteTrail:
    """Tests for delete_trail — deletes both trail and trail_details."""

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_deletes_trail_and_details(self, mock_sync, mock_collection) -> None:
        delete_trail("t1")

        # Should call get_collection twice (trails + trail_details)
        # and delete from both
        calls = mock_collection.document.call_args_list
        assert len(calls) == 2
        assert calls[0].args == ("t1",)
        assert calls[1].args == ("t1",)
        mock_sync.assert_called_once()

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_delete_trail_skips_sync_when_disabled(self, mock_sync, mock_collection) -> None:
        delete_trail("t1", update_sync=False)

        calls = mock_collection.document.call_args_list
        assert len(calls) == 2
        mock_sync.assert_not_called()


class TestSaveTrail:
    """Tests for save_trail — saves a TrailResponse to Firestore."""

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_saves_trail_with_timestamp(self, mock_sync, mock_collection) -> None:
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

        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-06-15T10:00:00Z"):
            save_trail(trail)

        mock_collection.document.assert_called_once_with("t1")
        saved_data = mock_collection.document.return_value.set.call_args[0][0]
        assert saved_data["trail_id"] == "t1"
        assert saved_data["name"] == "Test Trail"
        assert saved_data["last_updated"] == "2026-06-15T10:00:00Z"
        assert saved_data["created_at"] == "2026-06-15T10:00:00Z"
        assert saved_data["coordinates_map"] == [{"lat": 56.0, "lng": 13.0}]
        assert "duration_minutes" not in saved_data
        mock_sync.assert_called_once()

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_preserves_existing_created_at(self, mock_sync, mock_collection) -> None:
        trail = TrailResponse(
            trail_id="t1",
            name="Test Trail",
            difficulty="easy",
            length_km=5.0,
            status="To Explore",
            coordinates_map=[],
            bounds=TrailBounds(north=0, south=0, east=0, west=0),
            center=Coordinate(lat=0, lng=0),
            source="other_trails",
            last_updated="old",
            created_at="2026-01-01T00:00:00Z",
        )

        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-06-15T10:00:00Z"):
            save_trail(trail)

        saved_data = mock_collection.document.return_value.set.call_args[0][0]
        assert saved_data["created_at"] == "2026-01-01T00:00:00Z"
        assert saved_data["last_updated"] == "2026-06-15T10:00:00Z"

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_skips_sync_when_update_sync_false(self, mock_sync, mock_collection) -> None:
        trail = TrailResponse(
            trail_id="t1",
            name="Bulk Trail",
            difficulty="easy",
            length_km=5.0,
            status="To Explore",
            coordinates_map=[],
            bounds=TrailBounds(north=0, south=0, east=0, west=0),
            center=Coordinate(lat=0, lng=0),
            source="other_trails",
            last_updated="old",
        )

        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-06-15T10:00:00Z"):
            save_trail(trail, update_sync=False)

        mock_collection.document.return_value.set.assert_called_once()
        mock_sync.assert_not_called()


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
            created_at="2026-01-01T00:00:00Z",
            modified_at="2026-01-01T00:00:00Z",
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
        assert result["created_at"] == "2026-01-01T00:00:00Z"
        assert result["modified_at"] == "2026-01-01T00:00:00Z"
        assert result["activity_date"] == "2025-12-15"
        assert result["elevation_gain"] == 120.5
        assert result["group_id"] is None  # not set = public

    def test_full_trail_to_dict_includes_new_fields(self) -> None:
        trail = TrailResponse(
            trail_id="t1",
            name="Full Trail",
            difficulty="hard",
            length_km=15.0,
            status="Explored!",
            coordinates_map=[
                Coordinate(lat=56.0, lng=13.0, elevation=100.0),
                Coordinate(lat=56.1, lng=13.1, elevation=250.0),
            ],
            bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
            center=Coordinate(lat=56.05, lng=13.05),
            source="other_trails",
            last_updated="2026-01-01",
            duration_minutes=195,
            avg_inclination_deg=3.2,
            max_inclination_deg=12.5,
            elevation_gain=350.0,
            elevation_loss=280.0,
        )

        result = trail.to_dict()

        assert result["duration_minutes"] == 195
        assert result["avg_inclination_deg"] == 3.2
        assert result["max_inclination_deg"] == 12.5
        assert result["coordinates_map"] == [
            {"lat": 56.0, "lng": 13.0, "elevation": 100.0},
            {"lat": 56.1, "lng": 13.1, "elevation": 250.0},
        ]

    def test_to_dict_omits_elevation_when_none(self) -> None:
        trail = TrailResponse(
            trail_id="t1",
            name="No Elevation",
            difficulty="easy",
            length_km=5.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.0, south=56.0, east=13.0, west=13.0),
            center=Coordinate(lat=56.0, lng=13.0),
            source="other_trails",
            last_updated="2026-01-01",
        )

        result = trail.to_dict()

        assert result["coordinates_map"] == [{"lat": 56.0, "lng": 13.0}]

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
        assert "created_at" not in result
        assert "modified_at" not in result
        assert "elevation_gain" not in result
        assert "elevation_loss" not in result
        assert "duration_minutes" not in result
        assert "avg_inclination_deg" not in result
        assert "max_inclination_deg" not in result
        assert result["group_id"] is None  # always present even when None


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

    def test_details_to_dict_with_elevation(self) -> None:
        details = TrailDetailsResponse(
            trail_id="t1", coordinates_full=[Coordinate(lat=56.0, lng=13.0, elevation=100.0)]
        )

        result = details.to_dict()

        assert result["coordinates_full"] == [{"lat": 56.0, "lng": 13.0, "elevation": 100.0}]

    def test_minimal_details_to_dict(self) -> None:
        details = TrailDetailsResponse(trail_id="t2", coordinates_full=[])

        result = details.to_dict()

        assert result["trail_id"] == "t2"
        assert "elevation_profile" not in result
        assert "waypoints" not in result
        assert "statistics" not in result


class TestGetSyncMetadata:
    """Tests for get_sync_metadata."""

    def test_returns_metadata_from_doc(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(
            {"count": 42, "last_modified": "2026-03-01T12:00:00Z"}
        )

        result = get_sync_metadata()

        assert isinstance(result, SyncMetadata)
        assert result.count == 42
        assert result.last_modified == "2026-03-01T12:00:00Z"

    def test_returns_defaults_when_doc_missing(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=False)

        result = get_sync_metadata()

        assert result.count == 0
        assert result.last_modified is None

    def test_returns_defaults_when_data_is_none(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _make_doc(None, exists=True)

        result = get_sync_metadata()

        assert result.count == 0
        assert result.last_modified is None


class TestUpdateSyncMetadata:
    """Tests for _update_sync_metadata."""

    def test_counts_trails_and_sets_timestamp(self, mock_collection) -> None:
        mock_agg_result = MagicMock()
        mock_agg_result.value = 3
        mock_collection.count.return_value.get.return_value = [[mock_agg_result]]

        with patch("api.storage.trail_storage._utc_now_z", return_value="2026-03-01T12:00:00Z"):
            _update_sync_metadata()

        set_call = mock_collection.document.return_value.set.call_args[0][0]
        assert set_call["count"] == 3
        assert set_call["last_modified"] == "2026-03-01T12:00:00Z"

    @patch("api.storage.trail_storage._update_sync_metadata")
    def test_public_wrapper_delegates(self, mock_internal) -> None:
        update_sync_metadata()
        mock_internal.assert_called_once()


class TestUtcNowZ:
    """Tests for _utc_now_z helper."""

    def test_returns_z_suffix_format(self) -> None:
        result = _utc_now_z()
        assert result.endswith("Z")
        assert "+" not in result
