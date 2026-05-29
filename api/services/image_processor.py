"""Image processing: resize, compress, and extract EXIF geodata."""

import base64
import io
import logging

from PIL import ExifTags, Image

logger = logging.getLogger(__name__)

# Target: small thumbnails for memory/reminiscence, not print quality
MAX_DIMENSION = 800  # px — longest side
JPEG_QUALITY = 60


def process_image(raw_bytes: bytes) -> tuple[str, float | None, float | None]:
    """Process an uploaded image: resize, compress, extract GPS.

    Args:
        raw_bytes: Raw image file bytes.

    Returns:
        Tuple of (base64_jpeg, latitude, longitude).
        Lat/lng are None if no EXIF GPS data found.

    Raises:
        ValueError: If image is invalid.
    """
    if not raw_bytes:
        msg = "Empty image data"
        raise ValueError(msg)

    try:
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception as e:
        msg = "Invalid image file"
        raise ValueError(msg) from e

    lat, lng = _extract_gps(img)
    img = _auto_orient(img)
    img = _resize(img)
    b64 = _to_base64_jpeg(img)

    logger.info(
        "Processed image: %dx%d → base64 %d chars, GPS: %s",
        img.width,
        img.height,
        len(b64),
        "found" if lat is not None else "none",
    )
    return b64, lat, lng


def _extract_gps(img: Image.Image) -> tuple[float | None, float | None]:
    """Extract GPS coordinates from EXIF data."""
    try:
        exif = img.getexif()
        if not exif:
            return None, None

        # GPS info is in IFD 0x8825
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if not gps_ifd:
            return None, None

        gps_lat = gps_ifd.get(ExifTags.GPS.GPSLatitude)
        gps_lat_ref = gps_ifd.get(ExifTags.GPS.GPSLatitudeRef)
        gps_lng = gps_ifd.get(ExifTags.GPS.GPSLongitude)
        gps_lng_ref = gps_ifd.get(ExifTags.GPS.GPSLongitudeRef)

        if not gps_lat or not gps_lng:
            return None, None

        lat = _dms_to_decimal(gps_lat, gps_lat_ref)
        lng = _dms_to_decimal(gps_lng, gps_lng_ref)
        return lat, lng
    except Exception:  # pragma: no cover
        logger.debug("Failed to extract GPS from EXIF", exc_info=True)
        return None, None


def _dms_to_decimal(dms: tuple, ref: str | None) -> float:
    """Convert EXIF GPS DMS (degrees, minutes, seconds) to decimal degrees."""
    degrees = float(dms[0])
    minutes = float(dms[1])
    seconds = float(dms[2])
    decimal = degrees + minutes / 60 + seconds / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def _auto_orient(img: Image.Image) -> Image.Image:
    """Apply EXIF orientation rotation/flip based on EXIF tag.

    Note: EXIF data is stripped later during JPEG re-encoding in _to_base64_jpeg.
    """
    try:
        exif = img.getexif()
        orientation = exif.get(ExifTags.Base.Orientation)
        if orientation:
            rotate_map = {3: 180, 6: 270, 8: 90}
            if orientation in rotate_map:
                img = img.rotate(rotate_map[orientation], expand=True)
            elif orientation in (2, 4, 5, 7):  # pragma: no cover
                # Mirrored orientations — transpose then rotate
                img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                if orientation in (5, 7):
                    angle = 270 if orientation == 5 else 90  # noqa: PLR2004
                    img = img.rotate(angle, expand=True)
                elif orientation == 4:  # noqa: PLR2004
                    img = img.rotate(180, expand=True)
    except Exception:  # pragma: no cover
        logger.debug("Failed to auto-orient image", exc_info=True)
    return img


def _resize(img: Image.Image) -> Image.Image:
    """Resize image so longest side is MAX_DIMENSION, preserving aspect ratio."""
    if max(img.width, img.height) <= MAX_DIMENSION:
        return img
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
    return img


def _to_base64_jpeg(img: Image.Image) -> str:
    """Convert PIL Image to base64-encoded JPEG string."""
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")
