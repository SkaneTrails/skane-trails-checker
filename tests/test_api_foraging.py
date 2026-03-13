"""Tests for foraging API endpoints."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.models.foraging import ForagingSpotResponse, ForagingTypeResponse

client = TestClient(app)

SAMPLE_SPOT = ForagingSpotResponse(
    id="spot1",
    type="Mushrooms",
    lat=56.0,
    lng=13.5,
    notes="Near oak tree",
    month="Sep",
    date="2026-09-15",
    created_at="2026-09-15T10:00:00",
    last_updated="2026-09-15T10:00:00",
)

SAMPLE_SPOT_2 = ForagingSpotResponse(id="spot2", type="Blueberries", lat=56.1, lng=13.2, month="Jul")

SAMPLE_TYPE = ForagingTypeResponse(name="Mushrooms", icon="🍄", color="#8B4513")


class TestListForagingSpots:
    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_all_spots(self, mock_get):
        mock_get.return_value = [SAMPLE_SPOT, SAMPLE_SPOT_2]
        response = client.get("/api/v1/foraging/spots")
        assert response.status_code == 200
        assert len(response.json()) == 2
        mock_get.assert_called_once_with(month=None)

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_spots_by_month(self, mock_get):
        mock_get.return_value = [SAMPLE_SPOT]
        response = client.get("/api/v1/foraging/spots?month=Sep")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get.assert_called_once_with(month="Sep")

    def test_list_spots_invalid_month(self):
        response = client.get("/api/v1/foraging/spots?month=September")
        assert response.status_code == 422

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_spots_empty(self, mock_get):
        mock_get.return_value = []
        response = client.get("/api/v1/foraging/spots")
        assert response.status_code == 200
        assert response.json() == []


class TestCreateForagingSpot:
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.save_foraging_spot")
    def test_create_spot(self, mock_save, mock_get, authenticated_client):
        mock_save.return_value = "new_doc_id"
        mock_get.return_value = ForagingSpotResponse(id="new_doc_id", type="Herbs", lat=56.2, lng=13.3, month="Jun")

        response = authenticated_client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.2, "lng": 13.3, "month": "Jun"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "new_doc_id"
        assert data["type"] == "Herbs"

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.save_foraging_spot")
    def test_create_spot_sets_created_by(self, mock_save, mock_get, authenticated_client):
        mock_save.return_value = "new_doc_id"
        mock_get.return_value = ForagingSpotResponse(
            id="new_doc_id", type="Herbs", lat=56.2, lng=13.3, month="Jun", created_by="test-user"
        )

        authenticated_client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.2, "lng": 13.3, "month": "Jun"}
        )
        saved_data = mock_save.call_args[0][0]
        assert saved_data["created_by"] == "test-user"

    def test_create_spot_invalid_data(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/foraging/spots", json={"type": "", "lat": 56.0, "lng": 13.0, "month": "Jan"}
        )
        assert response.status_code == 422


class TestUpdateForagingSpot:
    @patch("api.routers.foraging.foraging_storage.update_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot(self, mock_get, mock_update, authenticated_client):
        mock_get.return_value = SAMPLE_SPOT
        mock_update.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "Updated notes"})
        assert response.status_code == 204

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_no_fields(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_SPOT
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={})
        assert response.status_code == 400

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/spots/nonexistent", json={"notes": "test"})
        assert response.status_code == 404

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_forbidden_when_not_owner(self, mock_get, authenticated_client):
        owned_by_other = SAMPLE_SPOT.model_copy(update={"created_by": "other-user"})
        mock_get.return_value = owned_by_other
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "test"})
        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]

    @patch("api.routers.foraging.foraging_storage.update_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_allowed_when_owner(self, mock_get, mock_update, authenticated_client):
        owned_by_me = SAMPLE_SPOT.model_copy(update={"created_by": "test-user"})
        mock_get.return_value = owned_by_me
        mock_update.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "test"})
        assert response.status_code == 204

    @patch("api.routers.foraging.foraging_storage.update_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_allowed_when_no_created_by(self, mock_get, mock_update, authenticated_client):
        """Legacy spots without created_by can be modified by any authenticated user."""
        legacy_spot = SAMPLE_SPOT.model_copy(update={"created_by": None})
        mock_get.return_value = legacy_spot
        mock_update.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "test"})
        assert response.status_code == 204


class TestDeleteForagingSpot:
    @patch("api.routers.foraging.foraging_storage.delete_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot(self, mock_get, mock_delete, authenticated_client):
        mock_get.return_value = SAMPLE_SPOT
        mock_delete.return_value = None
        response = authenticated_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("spot1")

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.delete("/api/v1/foraging/spots/nonexistent")
        assert response.status_code == 404

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot_forbidden_when_not_owner(self, mock_get, authenticated_client):
        owned_by_other = SAMPLE_SPOT.model_copy(update={"created_by": "other-user"})
        mock_get.return_value = owned_by_other
        response = authenticated_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 403
        assert "Not authorized" in response.json()["detail"]

    @patch("api.routers.foraging.foraging_storage.delete_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot_allowed_when_no_created_by(self, mock_get, mock_delete, authenticated_client):
        """Legacy spots without created_by can be deleted by any authenticated user."""
        legacy_spot = SAMPLE_SPOT.model_copy(update={"created_by": None})
        mock_get.return_value = legacy_spot
        mock_delete.return_value = None
        response = authenticated_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 204


class TestListForagingTypes:
    @patch("api.routers.foraging.foraging_storage.get_foraging_types")
    def test_list_types(self, mock_get):
        mock_get.return_value = [SAMPLE_TYPE]
        response = client.get("/api/v1/foraging/types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Mushrooms"
        assert data[0]["icon"] == "🍄"


class TestCreateForagingType:
    @patch("api.routers.foraging.foraging_storage.save_foraging_type")
    def test_create_type(self, mock_save, authenticated_client):
        mock_save.return_value = None
        response = authenticated_client.post(
            "/api/v1/foraging/types", json={"name": "Wild Garlic", "icon": "🌿", "color": "#228B22"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Wild Garlic"
        mock_save.assert_called_once_with("Wild Garlic", {"icon": "🌿", "color": "#228B22"})


class TestDeleteForagingType:
    @patch("api.routers.foraging.foraging_storage.delete_foraging_type")
    def test_delete_type(self, mock_delete, authenticated_client):
        mock_delete.return_value = None
        response = authenticated_client.delete("/api/v1/foraging/types/Mushrooms")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("Mushrooms")
