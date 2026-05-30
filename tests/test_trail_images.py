"""Tests for trail image API endpoints."""

import io
from unittest.mock import patch

from PIL import Image

from api.models.trail import Coordinate, TrailBounds, TrailImage, TrailImagesResponse, TrailResponse

TEST_GROUP_ID = "test-group"

SAMPLE_TRAIL = TrailResponse(
    trail_id="abc123",
    name="Test Trail",
    difficulty="Easy",
    length_km=5.5,
    status="To Explore",
    coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
    bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
    center=Coordinate(lat=56.05, lng=13.05),
    source="other_trails",
    last_updated="2026-01-01T00:00:00",
    group_id=TEST_GROUP_ID,
)


def _make_jpeg(width: int = 800, height: int = 600) -> bytes:
    """Create a small test JPEG."""
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


class TestGetTrailImages:
    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_images_empty(self, mock_get_trail, mock_get_images, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(trail_id="abc123", images=[])

        response = authenticated_client.get("/api/v1/trails/abc123/images")
        assert response.status_code == 200
        data = response.json()
        assert data["trail_id"] == "abc123"
        assert data["images"] == []

    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_images_with_data(self, mock_get_trail, mock_get_images, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(
            trail_id="abc123",
            images=[TrailImage(image_data="abc123base64", role="primary", lat=56.0, lng=13.0, caption="Peak view")],
        )

        response = authenticated_client.get("/api/v1/trails/abc123/images")
        assert response.status_code == 200
        data = response.json()
        assert len(data["images"]) == 1
        assert data["images"][0]["role"] == "primary"
        assert data["images"][0]["lat"] == 56.0

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_images_trail_not_found(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = None
        response = authenticated_client.get("/api/v1/trails/noexist/images")
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_get_images_wrong_group(self, mock_get_trail, authenticated_client):
        other_group_trail = SAMPLE_TRAIL.model_copy(update={"group_id": "other-group"})
        mock_get_trail.return_value = other_group_trail
        response = authenticated_client.get("/api/v1/trails/abc123/images")
        assert response.status_code == 403


class TestUploadTrailImage:
    @patch("api.routers.trails.trail_storage.save_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_primary_image(self, mock_get_trail, mock_get_images, mock_save, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(trail_id="abc123", images=[])

        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary&caption=Summit",
            files={"file": ("photo.jpg", jpeg_data, "image/jpeg")},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["images"]) == 1
        assert data["images"][0]["role"] == "primary"
        assert data["images"][0]["caption"] == "Summit"
        mock_save.assert_called_once()

    @patch("api.routers.trails.trail_storage.save_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_replaces_existing_primary(self, mock_get_trail, mock_get_images, mock_save, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(
            trail_id="abc123", images=[TrailImage(image_data="old", role="primary")]
        )

        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("new.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 201
        data = response.json()
        # Should have exactly 1 primary (old replaced)
        assert len(data["images"]) == 1
        assert data["images"][0]["role"] == "primary"

    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_rejects_when_max_reached(self, mock_get_trail, mock_get_images, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(
            trail_id="abc123",
            images=[
                TrailImage(image_data="a", role="primary"),
                TrailImage(image_data="b", role="secondary"),
                TrailImage(image_data="c", role="secondary"),
            ],
        )

        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=secondary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 400
        assert "secondary" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_rejects_third_secondary_even_without_primary(
        self, mock_get_trail, mock_get_images, authenticated_client
    ):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(
            trail_id="abc123",
            images=[TrailImage(image_data="b", role="secondary"), TrailImage(image_data="c", role="secondary")],
        )

        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=secondary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 400
        assert "secondary" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_empty_file(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("empty.jpg", b"", "image/jpeg")}
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_oversized_file(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        big_data = b"\xff" * (15 * 1024 * 1024 + 1)
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("big.jpg", big_data, "image/jpeg")}
        )
        assert response.status_code == 413

    @patch("api.routers.trails.process_image")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_processed_image_too_large(self, mock_get_trail, mock_process, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_process.return_value = ("x" * 400_000, None, None)  # over 300KB limit
        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 413
        assert "Processed image too large" in response.json()["detail"]

    @patch("api.routers.trails.trail_storage.save_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_generates_thumbnail_when_gps_present(
        self, mock_get_trail, mock_get_images, mock_save, authenticated_client
    ):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(trail_id="abc123", images=[])

        with (
            patch("api.routers.trails.process_image", return_value=("b64img", 55.5, 13.2)),
            patch("api.routers.trails.generate_thumbnail", return_value="tiny_thumb") as mock_thumb,
        ):
            jpeg_data = _make_jpeg()
            response = authenticated_client.post(
                "/api/v1/trails/abc123/images?role=primary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
            )
            assert response.status_code == 201
            mock_thumb.assert_called_once_with("b64img")
            saved_images = mock_save.call_args[0][1]
            assert saved_images[0].thumbnail == "tiny_thumb"

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_invalid_image(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        response = authenticated_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("bad.jpg", b"not an image", "image/jpeg")}
        )
        assert response.status_code == 400

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_trail_not_found(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = None
        jpeg_data = _make_jpeg()
        response = authenticated_client.post(
            "/api/v1/trails/noexist/images?role=primary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_upload_member_forbidden(self, mock_get_trail, member_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        jpeg_data = _make_jpeg()
        response = member_client.post(
            "/api/v1/trails/abc123/images?role=primary", files={"file": ("photo.jpg", jpeg_data, "image/jpeg")}
        )
        assert response.status_code == 403


class TestDeleteTrailImage:
    @patch("api.routers.trails.trail_storage.save_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_image(self, mock_get_trail, mock_get_images, mock_save, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(
            trail_id="abc123",
            images=[TrailImage(image_data="a", role="primary"), TrailImage(image_data="b", role="secondary")],
        )

        response = authenticated_client.delete("/api/v1/trails/abc123/images/0")
        assert response.status_code == 204
        # Should save with only the second image
        saved_images = mock_save.call_args[0][1]
        assert len(saved_images) == 1
        assert saved_images[0].role == "secondary"

    @patch("api.routers.trails.trail_storage.get_trail_images")
    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_image_invalid_index(self, mock_get_trail, mock_get_images, authenticated_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        mock_get_images.return_value = TrailImagesResponse(trail_id="abc123", images=[])

        response = authenticated_client.delete("/api/v1/trails/abc123/images/0")
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_image_trail_not_found(self, mock_get_trail, authenticated_client):
        mock_get_trail.return_value = None
        response = authenticated_client.delete("/api/v1/trails/noexist/images/0")
        assert response.status_code == 404

    @patch("api.routers.trails.trail_storage.get_trail")
    def test_delete_image_member_forbidden(self, mock_get_trail, member_client):
        mock_get_trail.return_value = SAMPLE_TRAIL
        response = member_client.delete("/api/v1/trails/abc123/images/0")
        assert response.status_code == 403


class TestGetImagePins:
    @patch("api.routers.trails.trail_storage.get_image_pins")
    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_returns_pins(self, mock_get_all, mock_get_pins, authenticated_client):
        mock_get_all.return_value = [
            TrailResponse(
                trail_id="t1",
                name="Explored",
                difficulty="Easy",
                length_km=3.0,
                status="Explored!",
                coordinates_map=[],
                bounds=TrailBounds(north=56, south=55, east=14, west=13),
                center=Coordinate(lat=55.5, lng=13.5),
                source="other_trails",
                last_updated="2026-01-01T00:00:00",
                group_id=TEST_GROUP_ID,
            ),
            TrailResponse(
                trail_id="t2",
                name="Unexplored",
                difficulty="Easy",
                length_km=2.0,
                status="To Explore",
                coordinates_map=[],
                bounds=TrailBounds(north=56, south=55, east=14, west=13),
                center=Coordinate(lat=55.5, lng=13.5),
                source="other_trails",
                last_updated="2026-01-01T00:00:00",
                group_id=TEST_GROUP_ID,
            ),
        ]
        from api.models.trail import ImagePin

        mock_get_pins.return_value = [ImagePin(trail_id="t1", lat=55.5, lng=13.2, thumbnail="thumb")]

        response = authenticated_client.get("/api/v1/trails/image-pins")
        assert response.status_code == 200
        data = response.json()
        assert len(data["pins"]) == 1
        assert data["pins"][0] == {"trail_id": "t1", "lat": 55.5, "lng": 13.2, "thumbnail": "thumb"}
        # Should only pass explored trail IDs
        mock_get_pins.assert_called_once_with(["t1"])

    @patch("api.routers.trails.trail_storage.get_image_pins")
    @patch("api.routers.trails.trail_storage.get_all_trails")
    def test_empty_when_no_explored(self, mock_get_all, mock_get_pins, authenticated_client):
        mock_get_all.return_value = []
        mock_get_pins.return_value = []

        response = authenticated_client.get("/api/v1/trails/image-pins")
        assert response.status_code == 200
        assert response.json()["pins"] == []
