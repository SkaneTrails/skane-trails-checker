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
    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    @patch("api.routers.foraging.foraging_storage.save_foraging_spot")
    def test_create_spot(self, mock_save, mock_get):
        mock_save.return_value = "new_doc_id"
        mock_get.return_value = [ForagingSpotResponse(id="new_doc_id", type="Herbs", lat=56.2, lng=13.3, month="Jun")]

        response = client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.2, "lng": 13.3, "month": "Jun"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "new_doc_id"
        assert data["type"] == "Herbs"

    def test_create_spot_invalid_data(self):
        response = client.post("/api/v1/foraging/spots", json={"type": "", "lat": 56.0, "lng": 13.0, "month": "Jan"})
        assert response.status_code == 422


class TestUpdateForagingSpot:
    @patch("api.routers.foraging.foraging_storage.update_foraging_spot")
    def test_update_spot(self, mock_update):
        mock_update.return_value = None
        response = client.patch("/api/v1/foraging/spots/spot1", json={"notes": "Updated notes"})
        assert response.status_code == 204

    def test_update_spot_no_fields(self):
        response = client.patch("/api/v1/foraging/spots/spot1", json={})
        assert response.status_code == 400


class TestDeleteForagingSpot:
    @patch("api.routers.foraging.foraging_storage.delete_foraging_spot")
    def test_delete_spot(self, mock_delete):
        mock_delete.return_value = None
        response = client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("spot1")


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
    def test_create_type(self, mock_save):
        mock_save.return_value = None
        response = client.post("/api/v1/foraging/types", json={"name": "Wild Garlic", "icon": "🌿", "color": "#228B22"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Wild Garlic"
        mock_save.assert_called_once_with("Wild Garlic", {"icon": "🌿", "color": "#228B22"})


class TestDeleteForagingType:
    @patch("api.routers.foraging.foraging_storage.delete_foraging_type")
    def test_delete_type(self, mock_delete):
        mock_delete.return_value = None
        response = client.delete("/api/v1/foraging/types/Mushrooms")
        assert response.status_code == 204
        mock_delete.assert_called_once_with("Mushrooms")
