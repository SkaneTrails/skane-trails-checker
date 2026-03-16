"""Tests for foraging API endpoints."""

from unittest.mock import patch

from api.models.foraging import ForagingSpotResponse, ForagingTypeResponse

TEST_GROUP_ID = "test-group"

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
    group_id=TEST_GROUP_ID,
)

SAMPLE_SPOT_2 = ForagingSpotResponse(
    id="spot2", type="Blueberries", lat=56.1, lng=13.2, month="Jul", group_id=TEST_GROUP_ID
)

SAMPLE_TYPE = ForagingTypeResponse(name="Mushrooms", icon="🍄", color="#8B4513")


class TestListForagingSpots:
    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_all_spots_superuser(self, mock_get, superuser_client):
        """Superuser sees all spots (group_id=None)."""
        mock_get.return_value = [SAMPLE_SPOT]
        response = superuser_client.get("/api/v1/foraging/spots")
        assert response.status_code == 200
        mock_get.assert_called_once_with(month=None, group_id=None)

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_all_spots(self, mock_get, authenticated_client):
        mock_get.return_value = [SAMPLE_SPOT, SAMPLE_SPOT_2]
        response = authenticated_client.get("/api/v1/foraging/spots")
        assert response.status_code == 200
        assert len(response.json()) == 2
        mock_get.assert_called_once_with(month=None, group_id=TEST_GROUP_ID)

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_spots_by_month(self, mock_get, authenticated_client):
        mock_get.return_value = [SAMPLE_SPOT]
        response = authenticated_client.get("/api/v1/foraging/spots?month=Sep")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get.assert_called_once_with(month="Sep", group_id=TEST_GROUP_ID)

    def test_list_spots_invalid_month(self, authenticated_client):
        response = authenticated_client.get("/api/v1/foraging/spots?month=September")
        assert response.status_code == 422

    @patch("api.routers.foraging.foraging_storage.get_foraging_spots")
    def test_list_spots_empty(self, mock_get, authenticated_client):
        mock_get.return_value = []
        response = authenticated_client.get("/api/v1/foraging/spots")
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

    def test_create_spot_forbidden_member(self, member_client):
        """Members cannot create spots."""
        response = member_client.post(
            "/api/v1/foraging/spots", json={"type": "Herbs", "lat": 56.2, "lng": 13.3, "month": "Jun"}
        )
        assert response.status_code == 403

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
    def test_update_spot_forbidden_wrong_group(self, mock_get, authenticated_client):
        other_group_spot = SAMPLE_SPOT.model_copy(update={"group_id": "other-group"})
        mock_get.return_value = other_group_spot
        response = authenticated_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "test"})
        assert response.status_code == 403

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_forbidden_member(self, mock_get, member_client):
        """Members (view-only) cannot modify foraging spots."""
        mock_get.return_value = SAMPLE_SPOT
        response = member_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "test"})
        assert response.status_code == 403

    @patch("api.routers.foraging.foraging_storage.update_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_update_spot_superuser(self, mock_get, mock_update, superuser_client):
        """Superuser can update any spot."""
        mock_get.return_value = SAMPLE_SPOT
        mock_update.return_value = None
        response = superuser_client.patch("/api/v1/foraging/spots/spot1", json={"notes": "su edit"})
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
    def test_delete_spot_forbidden_wrong_group(self, mock_get, authenticated_client):
        other_group_spot = SAMPLE_SPOT.model_copy(update={"group_id": "other-group"})
        mock_get.return_value = other_group_spot
        response = authenticated_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 403

    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot_forbidden_member(self, mock_get, member_client):
        """Members cannot delete foraging spots."""
        mock_get.return_value = SAMPLE_SPOT
        response = member_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 403

    @patch("api.routers.foraging.foraging_storage.delete_foraging_spot")
    @patch("api.routers.foraging.foraging_storage.get_foraging_spot")
    def test_delete_spot_superuser(self, mock_get, mock_delete, superuser_client):
        """Superuser can delete any spot."""
        mock_get.return_value = SAMPLE_SPOT
        mock_delete.return_value = None
        response = superuser_client.delete("/api/v1/foraging/spots/spot1")
        assert response.status_code == 204


class TestListForagingTypes:
    @patch("api.routers.foraging.foraging_storage.get_foraging_types")
    def test_list_types(self, mock_get, authenticated_client):
        mock_get.return_value = [SAMPLE_TYPE]
        response = authenticated_client.get("/api/v1/foraging/types")
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


class TestUpdateForagingType:
    @patch("api.routers.foraging.foraging_storage.get_foraging_type")
    @patch("api.routers.foraging.foraging_storage.update_foraging_type")
    def test_update_type(self, mock_update, mock_get, authenticated_client):
        updated_type = SAMPLE_TYPE.model_copy(update={"color": "#FF0000"})
        mock_get.side_effect = [SAMPLE_TYPE, updated_type]
        mock_update.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/types/Mushrooms", json={"color": "#FF0000"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Mushrooms"
        assert data["color"] == "#FF0000"
        mock_update.assert_called_once_with("Mushrooms", {"color": "#FF0000"})

    @patch("api.routers.foraging.foraging_storage.get_foraging_type")
    def test_update_type_not_found(self, mock_get, authenticated_client):
        mock_get.return_value = None
        response = authenticated_client.patch("/api/v1/foraging/types/Nonexistent", json={"color": "#FF0000"})
        assert response.status_code == 404

    @patch("api.routers.foraging.foraging_storage.get_foraging_type")
    def test_update_type_no_fields(self, mock_get, authenticated_client):
        mock_get.return_value = SAMPLE_TYPE
        response = authenticated_client.patch("/api/v1/foraging/types/Mushrooms", json={})
        assert response.status_code == 400
        assert "No fields to update" in response.json()["detail"]

    @patch("api.routers.foraging.foraging_storage.get_foraging_type")
    @patch("api.routers.foraging.foraging_storage.update_foraging_type")
    def test_update_type_multiple_fields(self, mock_update, mock_get, authenticated_client):
        updated_type = SAMPLE_TYPE.model_copy(update={"icon": "🍁", "season": "Autumn"})
        mock_get.side_effect = [SAMPLE_TYPE, updated_type]
        mock_update.return_value = None
        response = authenticated_client.patch(
            "/api/v1/foraging/types/Mushrooms", json={"icon": "🍁", "season": "Autumn"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["icon"] == "🍁"
        assert data["season"] == "Autumn"
