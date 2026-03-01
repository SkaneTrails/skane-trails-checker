"""Tests verifying auth enforcement on API endpoints.

Write endpoints (POST, PATCH, DELETE) should return 401 without auth.
Read endpoints (GET) should remain publicly accessible.
"""

import io
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


class TestReadEndpointsArePublic:
    """GET endpoints should work without authentication."""

    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_list_trails_no_auth(self, mock_get):
        mock_get.return_value = []
        response = client.get("/api/v1/trails")
        assert response.status_code == 200

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_foraging_spots_no_auth(self, mock_get):
        mock_get.return_value = []
        response = client.get("/api/v1/foraging/spots")
        assert response.status_code == 200

    @patch("api.routers.foraging.foraging_storage.get_foraging_types")
    def test_list_foraging_types_no_auth(self, mock_get):
        mock_get.return_value = []
        response = client.get("/api/v1/foraging/types")
        assert response.status_code == 200

    @patch("api.routers.places.places_storage.get_all_places")
    def test_list_places_no_auth(self, mock_get):
        mock_get.return_value = []
        response = client.get("/api/v1/places")
        assert response.status_code == 200


class TestWriteEndpointsRequireAuth:
    """Write endpoints should return 401 without a Bearer token."""

    def test_update_trail_requires_auth(self):
        response = client.patch("/api/v1/trails/some-id", json={"name": "New"})
        assert response.status_code == 401

    def test_delete_trail_requires_auth(self):
        response = client.delete("/api/v1/trails/some-id")
        assert response.status_code == 401

    def test_upload_gpx_requires_auth(self):
        response = client.post(
            "/api/v1/trails/upload", files={"file": ("trail.gpx", io.BytesIO(b"<gpx/>"), "application/gpx+xml")}
        )
        assert response.status_code == 401

    def test_create_foraging_spot_requires_auth(self):
        response = client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.0, "lng": 13.0, "month": "Jan"}
        )
        assert response.status_code == 401

    def test_update_foraging_spot_requires_auth(self):
        response = client.patch("/api/v1/foraging/spots/some-id", json={"notes": "test"})
        assert response.status_code == 401

    def test_delete_foraging_spot_requires_auth(self):
        response = client.delete("/api/v1/foraging/spots/some-id")
        assert response.status_code == 401

    def test_create_foraging_type_requires_auth(self):
        response = client.post("/api/v1/foraging/types", json={"name": "Test", "icon": "🍄"})
        assert response.status_code == 401

    def test_delete_foraging_type_requires_auth(self):
        response = client.delete("/api/v1/foraging/types/Test")
        assert response.status_code == 401
