"""GPX file parsing service for trail uploads."""

import logging
import re

import gpxpy

from api.models.trail import Coordinate, TrailDetailsResponse, TrailResponse
from app.functions.trail_converter import detect_source, gpx_track_to_trail

logger = logging.getLogger(__name__)

# Matches <ele> tags with only whitespace (no numeric value)
_EMPTY_ELE_RE = re.compile(r"<ele>\s*</ele>")


def _build_trail_details(trail_id: str, track: "gpxpy.gpx.GPXTrack") -> TrailDetailsResponse:
    """Build TrailDetailsResponse from the full (unsimplified) GPX track points."""
    coords_full: list[Coordinate] = []
    elevation_profile: list[float] = []
    has_elevation = True
    for seg in track.segments:
        for pt in seg.points:
            if pt.elevation is not None:
                coords_full.append(Coordinate(lat=pt.latitude, lng=pt.longitude, elevation=pt.elevation))
                elevation_profile.append(pt.elevation)
            else:
                coords_full.append(Coordinate(lat=pt.latitude, lng=pt.longitude))
                has_elevation = False
    return TrailDetailsResponse(
        trail_id=trail_id,
        coordinates_full=coords_full,
        elevation_profile=elevation_profile if has_elevation and elevation_profile else None,
    )


def parse_gpx_upload(content: bytes) -> list[tuple[TrailResponse, TrailDetailsResponse]]:
    """Parse GPX file content and return (trail, details) tuples.

    Source is auto-detected from coordinates: trails within Skåne's
    bounding box are 'other_trails', everything else 'world_wide_hikes'.

    Args:
        content: Raw GPX file bytes

    Returns:
        List of (TrailResponse, TrailDetailsResponse) tuples ready for storage

    Raises:
        ValueError: If the GPX file is invalid or contains no tracks
    """
    try:
        xml = content.decode("utf-8")
        xml = _EMPTY_ELE_RE.sub("", xml)
        gpx_data = gpxpy.parse(xml)
    except Exception as e:
        msg = f"Invalid GPX file: {e}"
        raise ValueError(msg) from e

    if not gpx_data.tracks:
        msg = "GPX file contains no tracks"
        raise ValueError(msg)

    gpx_metadata = {}
    if gpx_data.time:
        gpx_metadata["time"] = gpx_data.time.isoformat()

    results: list[tuple[TrailResponse, TrailDetailsResponse]] = []
    for i, track in enumerate(gpx_data.tracks):
        try:
            points = (p for seg in track.segments for p in seg.points)
            coords_gen = ((p.latitude, p.longitude) for p in points)
            source = detect_source(coords_gen)
            trail = gpx_track_to_trail(track, source=source, index=i, status="Explored!", gpx_metadata=gpx_metadata)
            details = _build_trail_details(trail.trail_id, track)
            results.append((trail, details))
        except ValueError:
            logger.warning("Skipping track '%s' (no coordinates)", track.name)
            continue

    if not results:
        msg = "No valid tracks found in GPX file"
        raise ValueError(msg)

    logger.info("Parsed %d trail(s) from GPX upload", len(results))
    return results
