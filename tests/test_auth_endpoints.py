"""Tests verifying auth enforcement on API endpoints.

All data endpoints (GET, POST, PATCH, DELETE) require auth.
Only public infrastructure endpoints (health, sync metadata) are unauthenticated.
Places remain publicly readable.
"""

import io
from unittest.mock import patch


class TestPublicEndpoints:
    """Endpoints that should work without authentication."""

    @patch("api.routers.places.places_storage.get_all_places")
    def test_list_places_no_auth(self, mock_get, unauthenticated_client):
        mock_get.return_value = []
        response = unauthenticated_client.get("/api/v1/places")
        assert response.status_code == 200


class TestReadEndpointsRequireAuth:
    """GET endpoints for group-scoped data should return 401 without auth."""

    def test_list_trails_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.get("/api/v1/trails")
        assert response.status_code == 401

    def test_list_foraging_spots_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.get("/api/v1/foraging/spots")
        assert response.status_code == 401

    def test_list_foraging_types_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.get("/api/v1/foraging/types")
        assert response.status_code == 401


class TestWriteEndpointsRequireAuth:
    """Write endpoints should return 401 without a Bearer token."""

    def test_update_trail_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.patch("/api/v1/trails/some-id", json={"name": "New"})
        assert response.status_code == 401

    def test_delete_trail_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.delete("/api/v1/trails/some-id")
        assert response.status_code == 401

    def test_upload_gpx_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.post(
            "/api/v1/trails/upload", files={"file": ("trail.gpx", io.BytesIO(b"<gpx/>"), "application/gpx+xml")}
        )
        assert response.status_code == 401

    def test_create_foraging_spot_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.0, "lng": 13.0, "month": "Jan"}
        )
        assert response.status_code == 401

    def test_update_foraging_spot_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.patch("/api/v1/foraging/spots/some-id", json={"notes": "test"})
        assert response.status_code == 401

    def test_delete_foraging_spot_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.delete("/api/v1/foraging/spots/some-id")
        assert response.status_code == 401

    def test_create_foraging_type_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.post("/api/v1/foraging/types", json={"name": "Test", "icon": "🍄"})
        assert response.status_code == 401

    def test_delete_foraging_type_requires_auth(self, unauthenticated_client):
        response = unauthenticated_client.delete("/api/v1/foraging/types/Test")
        assert response.status_code == 401
