"""GPX file parsing service for trail uploads."""

import logging

import gpxpy

from api.models.trail import TrailResponse
from app.functions.trail_converter import gpx_track_to_trail

logger = logging.getLogger(__name__)


def parse_gpx_upload(content: bytes, *, source: str = "other_trails") -> list[TrailResponse]:
    """Parse GPX file content and return TrailResponse objects.

    Args:
        content: Raw GPX file bytes
        source: Trail source identifier ('other_trails' or 'world_wide_hikes')

    Returns:
        List of TrailResponse objects ready for storage

    Raises:
        ValueError: If the GPX file is invalid or contains no tracks
    """
    try:
        gpx_data = gpxpy.parse(content.decode("utf-8"))
    except Exception as e:
        msg = f"Invalid GPX file: {e}"
        raise ValueError(msg) from e

    if not gpx_data.tracks:
        msg = "GPX file contains no tracks"
        raise ValueError(msg)

    gpx_metadata = {}
    if gpx_data.time:
        gpx_metadata["time"] = gpx_data.time.isoformat()

    trails: list[TrailResponse] = []
    for i, track in enumerate(gpx_data.tracks):
        try:
            trail = gpx_track_to_trail(track, source=source, index=i, status="Explored!", gpx_metadata=gpx_metadata)
            trails.append(trail)
        except ValueError:
            logger.warning("Skipping track '%s' (no coordinates)", track.name)
            continue

    if not trails:
        msg = "No valid tracks found in GPX file"
        raise ValueError(msg)

    logger.info("Parsed %d trail(s) from GPX upload", len(trails))
    return trails
