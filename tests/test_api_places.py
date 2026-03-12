"""Tests for places API endpoints."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import app
from api.models.place import PlaceCategoryResponse, PlaceResponse

client = TestClient(app)

SAMPLE_PLACE = PlaceResponse(
    place_id="p1",
    name="Söderåsen Parkering",
    lat=56.05,
    lng=13.25,
    categories=[
        PlaceCategoryResponse(name="Parkering", slug="parkering", icon="🅿️"),
        PlaceCategoryResponse(name="Toalett", slug="toalett", icon="🚻"),
    ],
    city="Ljungbyhed",
    source="skaneleden",
)

SAMPLE_PLACE_2 = PlaceResponse(
    place_id="p2",
    name="Stenshuvud Badplats",
    lat=55.66,
    lng=14.27,
    categories=[PlaceCategoryResponse(name="Badplats", slug="badplats", icon="🏊")],
    city="Simrishamn",
)


class TestListPlaces:
    @patch("api.routers.places.places_storage.get_all_places")
    def test_list_all_places(self, mock_get_all):
        mock_get_all.return_value = [SAMPLE_PLACE, SAMPLE_PLACE_2]
        response = client.get("/api/v1/places")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["place_id"] == "p1"

    @patch("api.routers.places.places_storage.get_places_by_category")
    def test_list_places_by_category(self, mock_get_cat):
        mock_get_cat.return_value = [SAMPLE_PLACE]
        response = client.get("/api/v1/places?category=parkering")
        assert response.status_code == 200
        assert len(response.json()) == 1
        mock_get_cat.assert_called_once_with("parkering")

    @patch("api.routers.places.places_storage.get_all_places")
    def test_list_places_empty(self, mock_get_all):
        mock_get_all.return_value = []
        response = client.get("/api/v1/places")
        assert response.status_code == 200
        assert response.json() == []


class TestListCategories:
    def test_list_categories(self):
        response = client.get("/api/v1/places/categories")
        assert response.status_code == 200
        data = response.json()
        assert "parkering" in data
        assert data["parkering"]["name"] == "Parkering"
        assert len(data) == 14


class TestHealthCheck:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Skåne Trails API"
        assert data["version"] == "0.1.0"


class TestSecurityHeaders:
    def test_security_headers_present(self):
        response = client.get("/health")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "camera=()" in response.headers["Permissions-Policy"]


class TestGlobalExceptionHandler:
    @patch("api.routers.places.places_storage.get_all_places")
    def test_unhandled_exception_returns_500(self, mock_get_all):
        mock_get_all.side_effect = RuntimeError("unexpected")
        error_client = TestClient(app, raise_server_exceptions=False)
        response = error_client.get("/api/v1/places")
        assert response.status_code == 500
        assert response.json() == {"detail": "Internal server error"}


class TestInvalidDocumentIdHandler:
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_invalid_document_id_returns_400(self, mock_get_trail):
        from api.storage.validation import InvalidDocumentIdError

        mock_get_trail.side_effect = InvalidDocumentIdError("Invalid trail_id: contains invalid characters")
        response = client.get("/api/v1/trails/bad-id")
        assert response.status_code == 400
        assert "invalid characters" in response.json()["detail"]
