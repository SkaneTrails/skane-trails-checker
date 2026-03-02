"""Tests for trail API endpoints."""

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
        assert data[0]["trail_id"] == "abc123"
        assert data[1]["trail_id"] == "def456"
        mock_get_all.assert_called_once_with(source=None, since=None)

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
