"""Tests for trail API endpoints."""

from typing import ClassVar
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.models.trail import Coordinate, SyncMetadata, TrailBounds, TrailDetailsResponse, TrailResponse

client = TestClient(app)

SAMPLE_TRAIL = TrailResponse(
    trail_id="abc123",
    name="Test Trail",
    difficulty="Easy",
    length_km=5.5,
    status="To Explore",
    coordinates_map=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)],
    bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
    center=Coordinate(lat=56.05, lng=13.05),
    source="planned_hikes",
    last_updated="2026-01-01T00:00:00",
)

SAMPLE_TRAIL_2 = TrailResponse(
    trail_id="def456",
    name="Mountain Hike",
    difficulty="Medium",
    length_km=15.0,
    status="Explored!",
    coordinates_map=[Coordinate(lat=57.0, lng=14.0)],
    bounds=TrailBounds(north=57.0, south=57.0, east=14.0, west=14.0),
    center=Coordinate(lat=57.0, lng=14.0),
    source="other_trails",
    last_updated="2026-01-15T00:00:00",
    elevation_gain=350.0,
)

SAMPLE_DETAILS = TrailDetailsResponse(
    trail_id="abc123",
    coordinates_full=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.05, lng=13.05), Coordinate(lat=56.1, lng=13.1)],
    elevation_profile=[100.0, 150.0, 120.0],
)


class TestListTrails:
    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_all_trails(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL, SAMPLE_TRAIL_2]
        response = client.get("/api/v1/trails")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Uploaded trails (other_trails) sorted before planned_hikes
        assert data[0]["trail_id"] == "def456"
        assert data[1]["trail_id"] == "abc123"
        mock_get_all.assert_called_once_with(source=None, since=None)

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_sorts_uploaded_before_planned(self, mock_get_all):
        """Uploaded trails (other_trails, world_wide_hikes) appear before planned_hikes."""
        planned_a = TrailResponse(
            trail_id="p1",
            name="Alpha Planned",
            difficulty="Easy",
            length_km=3.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.0, south=56.0, east=13.0, west=13.0),
            center=Coordinate(lat=56.0, lng=13.0),
            source="planned_hikes",
            last_updated="2026-01-01T00:00:00",
        )
        planned_b = TrailResponse(
            trail_id="p2",
            name="Beta Planned",
            difficulty="Easy",
            length_km=4.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.0, south=56.0, east=13.0, west=13.0),
            center=Coordinate(lat=56.0, lng=13.0),
            source="planned_hikes",
            last_updated="2026-01-01T00:00:00",
        )
        uploaded_a = TrailResponse(
            trail_id="u1",
            name="Zeta Upload",
            difficulty="Hard",
            length_km=10.0,
            status="Explored!",
            coordinates_map=[Coordinate(lat=57.0, lng=14.0)],
            bounds=TrailBounds(north=57.0, south=57.0, east=14.0, west=14.0),
            center=Coordinate(lat=57.0, lng=14.0),
            source="other_trails",
            last_updated="2026-01-15T00:00:00",
        )
        uploaded_b = TrailResponse(
            trail_id="u2",
            name="Alpha Upload",
            difficulty="Medium",
            length_km=8.0,
            status="Explored!",
            coordinates_map=[Coordinate(lat=57.0, lng=14.0)],
            bounds=TrailBounds(north=57.0, south=57.0, east=14.0, west=14.0),
            center=Coordinate(lat=57.0, lng=14.0),
            source="world_wide_hikes",
            last_updated="2026-01-20T00:00:00",
        )
        # Return in arbitrary order from storage
        mock_get_all.return_value = [planned_b, uploaded_a, planned_a, uploaded_b]
        response = client.get("/api/v1/trails")
        assert response.status_code == 200
        data = response.json()
        ids = [t["trail_id"] for t in data]
        # Uploaded first (alphabetically), then planned (alphabetically)
        assert ids == ["u2", "u1", "p1", "p2"]

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_filter_by_source(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL]
        response = client.get("/api/v1/trails?source=planned_hikes")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get_all.assert_called_once_with(source="planned_hikes", since=None)

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_filter_by_search(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL, SAMPLE_TRAIL_2]
        response = client.get("/api/v1/trails?search=mountain")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Mountain Hike"

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_filter_by_distance(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL, SAMPLE_TRAIL_2]
        response = client.get("/api/v1/trails?min_distance_km=10&max_distance_km=20")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["trail_id"] == "def456"

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_filter_by_status(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL, SAMPLE_TRAIL_2]
        response = client.get("/api/v1/trails?status=Explored!")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "Explored!"

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_empty(self, mock_get_all):
        mock_get_all.return_value = []
        response = client.get("/api/v1/trails")
        assert response.status_code == 200
        assert response.json() == []

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_with_since(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL]
        response = client.get("/api/v1/trails?since=2026-03-01T00:00:00Z")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get_all.assert_called_once_with(source=None, since="2026-03-01T00:00:00Z")

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_with_source_and_since(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL]
        response = client.get("/api/v1/trails?source=planned_hikes&since=2026-03-01T00:00:00Z")
        assert response.status_code == 200
        mock_get_all.assert_called_once_with(source="planned_hikes", since="2026-03-01T00:00:00Z")

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_with_since_milliseconds(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_TRAIL]
        response = client.get("/api/v1/trails?since=2026-03-01T00:00:00.123Z")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get_all.assert_called_once_with(source=None, since="2026-03-01T00:00:00.123Z")

    def test_list_trails_rejects_invalid_since_format(self):
        response = client.get("/api/v1/trails?since=2026-03-01")
        assert response.status_code == 422


class TestGetSyncMetadata:
    @patch("api.routers.trails.trail_storage.get_sync_metadata")
    def test_get_sync_metadata(self, mock_get_sync):
        mock_get_sync.return_value = SyncMetadata(count=42, last_modified="2026-03-01T12:00:00Z")
        response = client.get("/api/v1/trails/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 42
        assert data["last_modified"] == "2026-03-01T12:00:00Z"

    @patch("api.routers.trails.trail_storage.get_sync_metadata")
    def test_get_sync_metadata_empty(self, mock_get_sync):
        mock_get_sync.return_value = SyncMetadata(count=0, last_modified=None)
        response = client.get("/api/v1/trails/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["last_modified"] is None


class TestGetTrail:
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_existing_trail(self, mock_get):
        mock_get.return_value = SAMPLE_TRAIL
        response = client.get("/api/v1/trails/abc123")
        assert response.status_code == 200
        data = response.json()
        assert data["trail_id"] == "abc123"
        assert data["name"] == "Test Trail"
        assert len(data["coordinates_map"]) == 2

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_nonexistent_trail(self, mock_get):
        mock_get.return_value = None
        response = client.get("/api/v1/trails/nonexistent")
        assert response.status_code == 404
        assert response.json()["detail"] == "Trail not found"


class TestGetTrailDetails:
    @patch("api.routers.trails.trail_storage.get_trail_details")
    def test_get_trail_details(self, mock_get):
        mock_get.return_value = SAMPLE_DETAILS
        response = client.get("/api/v1/trails/abc123/details")
        assert response.status_code == 200
        data = response.json()
        assert data["trail_id"] == "abc123"
        assert len(data["coordinates_full"]) == 3
        assert data["elevation_profile"] == [100.0, 150.0, 120.0]

    @patch("api.routers.trails.trail_storage.get_trail_details")
    def test_get_trail_details_not_found(self, mock_get):
        mock_get.return_value = None
        response = client.get("/api/v1/trails/nonexistent/details")
        assert response.status_code == 404


class TestUpdateTrail:
    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.update_trail")
    def test_update_trail_name(self, mock_update, mock_get, authenticated_client):
        updated_trail = SAMPLE_TRAIL.model_copy(update={"name": "Renamed Trail"})
        mock_get.side_effect = [SAMPLE_TRAIL, updated_trail]
        mock_update.return_value = None

        response = authenticated_client.patch("/api/v1/trails/abc123", json={"name": "Renamed Trail"})
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed Trail"
        mock_update.assert_called_once_with("abc123", {"name": "Renamed Trail"})

    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.update_trail")
    def test_update_trail_status(self, mock_update, mock_get, authenticated_client):
        updated_trail = SAMPLE_TRAIL.model_copy(update={"status": "Explored!"})
        mock_get.side_effect = [SAMPLE_TRAIL, updated_trail]
        mock_update.return_value = None

        response = authenticated_client.patch("/api/v1/trails/abc123", json={"status": "Explored!"})
        assert response.status_code == 200
        assert response.json()["status"] == "Explored!"

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_update_trail_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.patch("/api/v1/trails/nonexistent", json={"name": "New"})
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_update_trail_no_fields(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_TRAIL
        response = authenticated_client.patch("/api/v1/trails/abc123", json={})
        assert response.status_code == 400
        assert "No fields to update" in response.json()["detail"]

    def test_update_trail_invalid_status(self, authenticated_client):
        response = authenticated_client.patch("/api/v1/trails/abc123", json={"status": "Bad Status"})
        assert response.status_code == 422

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_update_trail_forbidden_when_not_owner(self, mock_get, authenticated_client):
        owned_by_other = SAMPLE_TRAIL.model_copy(update={"created_by": "other-user"})
        mock_get.return_value = owned_by_other
        response = authenticated_client.patch("/api/v1/trails/abc123", json={"name": "Stolen"})
        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.update_trail")
    def test_update_trail_allowed_when_owner(self, mock_update, mock_get, authenticated_client):
        owned = SAMPLE_TRAIL.model_copy(update={"created_by": "test-user"})
        updated = owned.model_copy(update={"name": "My Trail"})
        mock_get.side_effect = [owned, updated]
        mock_update.return_value = None
        response = authenticated_client.patch("/api/v1/trails/abc123", json={"name": "My Trail"})
        assert response.status_code == 200
        assert response.json()["name"] == "My Trail"

    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.update_trail")
    def test_update_trail_activity_date(self, mock_update, mock_get, authenticated_client):
        updated_trail = SAMPLE_TRAIL.model_copy(update={"activity_date": "2026-03-15"})
        mock_get.side_effect = [SAMPLE_TRAIL, updated_trail]
        mock_update.return_value = None

        response = authenticated_client.patch("/api/v1/trails/abc123", json={"activity_date": "2026-03-15"})
        assert response.status_code == 200
        assert response.json()["activity_date"] == "2026-03-15"
        mock_update.assert_called_once_with("abc123", {"activity_date": "2026-03-15"})

    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.update_trail")
    def test_update_trail_activity_type(self, mock_update, mock_get, authenticated_client):
        updated_trail = SAMPLE_TRAIL.model_copy(update={"activity_type": "Running"})
        mock_get.side_effect = [SAMPLE_TRAIL, updated_trail]
        mock_update.return_value = None

        response = authenticated_client.patch("/api/v1/trails/abc123", json={"activity_type": "Running"})
        assert response.status_code == 200
        assert response.json()["activity_type"] == "Running"
        mock_update.assert_called_once_with("abc123", {"activity_type": "Running"})


class TestDeleteTrail:
    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.delete_trail")
    def test_delete_trail(self, mock_delete, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_TRAIL
        mock_delete.return_value = None

        response = authenticated_client.delete("/api/v1/trails/abc123")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("abc123")

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_trail_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.delete("/api/v1/trails/nonexistent")
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_trail_forbidden_when_not_owner(self, mock_get, authenticated_client):
        owned_by_other = SAMPLE_TRAIL.model_copy(update={"created_by": "other-user"})
        mock_get.return_value = owned_by_other
        response = authenticated_client.delete("/api/v1/trails/abc123")
        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.get_trail")
    @patch("api.routers.trails.trail_storage.delete_trail")
    def test_delete_trail_allowed_when_no_created_by(self, mock_delete, mock_get, authenticated_client):
        """Legacy trails without created_by can be deleted by any authenticated user."""
        mock_get.return_value = SAMPLE_TRAIL  # created_by=None
        mock_delete.return_value = None
        response = authenticated_client.delete("/api/v1/trails/abc123")
        assert response.status_code == 204


class TestSaveRecording:
    """Tests for POST /trails/record endpoint."""

    SAMPLE_RECORDING: ClassVar[dict[str, object]] = {
        "name": "Morning Hike",
        "coordinates": [
            {"lat": 55.600, "lng": 13.000, "altitude": 50.0, "timestamp": 1700000000000},
            {"lat": 55.601, "lng": 13.000, "altitude": 55.0, "timestamp": 1700000030000},
            {"lat": 55.602, "lng": 13.000, "altitude": 60.0, "timestamp": 1700000060000},
            {"lat": 55.603, "lng": 13.000, "altitude": 55.0, "timestamp": 1700000090000},
            {"lat": 55.604, "lng": 13.000, "altitude": 50.0, "timestamp": 1700000120000},
        ],
        "source": "gps_recording",
    }

    @patch("api.routers.trails.trail_storage.save_trail_details")
    @patch("api.routers.trails.trail_storage.save_trail")
    def test_save_recording_success(self, mock_save, mock_details, authenticated_client):
        mock_save.return_value = None
        mock_details.return_value = None

        response = authenticated_client.post("/api/v1/trails/record", json=self.SAMPLE_RECORDING)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Morning Hike"
        assert data["status"] == "Explored!"
        assert data["source"] == "gps_recording"
        assert data["length_km"] > 0
        assert data["elevation_gain"] is not None
        assert data["duration_minutes"] == 2
        mock_save.assert_called_once()
        mock_details.assert_called_once()

    @patch("api.routers.trails.trail_storage.save_trail_details")
    @patch("api.routers.trails.trail_storage.save_trail")
    def test_save_recording_without_elevation(self, mock_save, mock_details, authenticated_client):
        recording = {
            "name": "Flat Walk",
            "coordinates": [
                {"lat": 55.600, "lng": 13.000, "altitude": None, "timestamp": 1700000000000},
                {"lat": 55.601, "lng": 13.000, "altitude": None, "timestamp": 1700000060000},
                {"lat": 55.602, "lng": 13.000, "altitude": None, "timestamp": 1700000120000},
            ],
        }
        mock_save.return_value = None
        mock_details.return_value = None

        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 201
        data = response.json()
        assert data["elevation_gain"] is None
        assert data["elevation_loss"] is None

    @patch("api.routers.trails.trail_storage.save_trail_details")
    @patch("api.routers.trails.trail_storage.save_trail")
    def test_save_recording_default_source(self, mock_save, mock_details, authenticated_client):
        recording = {
            "name": "No Source",
            "coordinates": [
                {"lat": 55.600, "lng": 13.000, "altitude": 50.0, "timestamp": 1700000000000},
                {"lat": 55.601, "lng": 13.000, "altitude": 55.0, "timestamp": 1700000060000},
            ],
        }
        mock_save.return_value = None
        mock_details.return_value = None

        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 201
        assert response.json()["source"] == "gps_recording"

    def test_save_recording_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.post("/api/v1/trails/record", json=self.SAMPLE_RECORDING)
        assert response.status_code == 401

    def test_save_recording_rejects_empty_name(self, authenticated_client):
        recording = {**self.SAMPLE_RECORDING, "name": ""}
        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 422

    def test_save_recording_rejects_too_few_coords(self, authenticated_client):
        recording = {
            "name": "Short",
            "coordinates": [{"lat": 55.0, "lng": 13.0, "altitude": None, "timestamp": 1700000000000}],
        }
        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 422

    def test_save_recording_rejects_invalid_source(self, authenticated_client):
        recording = {**self.SAMPLE_RECORDING, "source": "invalid_source"}
        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 422

    def test_save_recording_rejects_invalid_lat(self, authenticated_client):
        recording = {
            "name": "Bad Coords",
            "coordinates": [
                {"lat": 91.0, "lng": 13.0, "altitude": None, "timestamp": 1700000000000},
                {"lat": 55.0, "lng": 13.0, "altitude": None, "timestamp": 1700000060000},
            ],
        }
        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 422

    def test_save_recording_rejects_invalid_lng(self, authenticated_client):
        recording = {
            "name": "Bad Coords",
            "coordinates": [
                {"lat": 55.0, "lng": 181.0, "altitude": None, "timestamp": 1700000000000},
                {"lat": 55.0, "lng": 13.0, "altitude": None, "timestamp": 1700000060000},
            ],
        }
        response = authenticated_client.post("/api/v1/trails/record", json=recording)
        assert response.status_code == 422
