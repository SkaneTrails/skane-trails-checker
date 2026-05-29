"""Tests for image processing service."""

import base64
import io

import pytest
from PIL import Image

from api.services.image_processor import MAX_DIMENSION, process_image


def _make_jpeg(width: int = 1600, height: int = 1200) -> bytes:
    """Create a test JPEG image."""
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _make_png(width: int = 800, height: int = 600) -> bytes:
    """Create a test PNG image."""
    img = Image.new("RGBA", (width, height), color=(100, 150, 200, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestProcessImage:
    def test_basic_jpeg(self):
        raw = _make_jpeg(1600, 1200)
        b64, lat, lng = process_image(raw)

        # Should return valid base64
        decoded = base64.b64decode(b64)
        img = Image.open(io.BytesIO(decoded))
        assert img.format == "JPEG"
        assert max(img.width, img.height) <= MAX_DIMENSION
        assert lat is None
        assert lng is None

    def test_png_converted_to_jpeg(self):
        raw = _make_png(1000, 800)
        b64, _lat, _lng = process_image(raw)

        decoded = base64.b64decode(b64)
        img = Image.open(io.BytesIO(decoded))
        assert img.format == "JPEG"
        assert max(img.width, img.height) <= MAX_DIMENSION

    def test_small_image_not_upscaled(self):
        raw = _make_jpeg(400, 300)
        b64, _, _ = process_image(raw)

        decoded = base64.b64decode(b64)
        img = Image.open(io.BytesIO(decoded))
        # Should not be upscaled, dimensions ≤ original
        assert img.width <= 400
        assert img.height <= 300

    def test_rejects_empty_input(self):
        with pytest.raises(ValueError, match="Empty image data"):
            process_image(b"")

    def test_rejects_invalid_image(self):
        with pytest.raises(ValueError, match="Invalid image file"):
            process_image(b"not an image at all")

    def test_landscape_resize(self):
        raw = _make_jpeg(3000, 2000)
        b64, _, _ = process_image(raw)

        decoded = base64.b64decode(b64)
        img = Image.open(io.BytesIO(decoded))
        assert img.width == MAX_DIMENSION
        assert img.height <= MAX_DIMENSION

    def test_portrait_resize(self):
        raw = _make_jpeg(1200, 2400)
        b64, _, _ = process_image(raw)

        decoded = base64.b64decode(b64)
        img = Image.open(io.BytesIO(decoded))
        assert img.height == MAX_DIMENSION
        assert img.width <= MAX_DIMENSION


class TestExifGpsExtraction:
    def test_image_with_gps_exif(self):
        """Test GPS extraction from an image with embedded EXIF GPS data."""
        # Build EXIF bytes manually using struct for GPS IFD
        # Simpler approach: use Pillow's Exif with direct tag assignment
        img = Image.new("RGB", (100, 100), color=(50, 100, 150))
        exif = img.getexif()

        # GPSInfo tag (0x8825) — build GPS IFD data
        # We need to write raw GPS data into the exif object
        # Pillow stores GPS in IFD 0x8825
        from PIL.ExifTags import IFD

        gps_ifd = exif.get_ifd(IFD.GPSInfo)
        # GPS tags: 1=LatRef, 2=Lat, 3=LngRef, 4=Lng
        gps_ifd[1] = "N"
        gps_ifd[2] = (55.0, 57.0, 0.0)
        gps_ifd[3] = "E"
        gps_ifd[4] = (13.0, 24.0, 0.0)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())

        b64, lat, lng = process_image(buf.getvalue())
        assert b64  # Valid base64 returned
        assert lat is not None
        assert lng is not None
        assert abs(lat - 55.95) < 0.01
        assert abs(lng - 13.40) < 0.01

    def test_southern_hemisphere_gps(self):
        """Test GPS with S/W references (negative coordinates)."""
        from api.services.image_processor import _dms_to_decimal

        lat = _dms_to_decimal((33.0, 52.0, 0.0), "S")
        lng = _dms_to_decimal((151.0, 12.0, 0.0), "W")
        assert lat < 0
        assert lng < 0
        assert abs(lat - (-33.8667)) < 0.01
        assert abs(lng - (-151.2)) < 0.01

    def test_exif_with_gps_ifd_but_no_lat(self):
        """GPS IFD exists but lat/lng are missing."""
        from PIL.ExifTags import IFD

        img = Image.new("RGB", (100, 100), color=(50, 100, 150))
        exif = img.getexif()
        gps_ifd = exif.get_ifd(IFD.GPSInfo)
        gps_ifd[0] = b"\x02\x03\x00\x00"  # GPSVersionID — not lat/lng

        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())

        _, lat, lng = process_image(buf.getvalue())
        assert lat is None
        assert lng is None

    def test_no_gps_returns_none(self):
        raw = _make_jpeg(100, 100)
        _, lat, lng = process_image(raw)
        assert lat is None
        assert lng is None


class TestAutoOrient:
    def test_rotated_image_orientation_3(self):
        """Image with EXIF orientation tag 3 (180° rotation)."""
        from PIL.ExifTags import Base

        img = Image.new("RGB", (200, 100), color=(255, 0, 0))
        exif = img.getexif()
        exif[Base.Orientation] = 3  # 180°

        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())

        b64, _, _ = process_image(buf.getvalue())
        decoded = base64.b64decode(b64)
        result = Image.open(io.BytesIO(decoded))
        # Dimensions should stay the same for 180° rotation
        assert result.width == 200
        assert result.height == 100

    def test_rotated_image_orientation_6(self):
        """Image with EXIF orientation tag 6 (270° rotation)."""
        from PIL.ExifTags import Base

        img = Image.new("RGB", (200, 100), color=(0, 255, 0))
        exif = img.getexif()
        exif[Base.Orientation] = 6  # 270° → width/height swap

        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())

        b64, _, _ = process_image(buf.getvalue())
        decoded = base64.b64decode(b64)
        result = Image.open(io.BytesIO(decoded))
        # 270° rotation swaps dimensions
        assert result.width == 100
        assert result.height == 200
