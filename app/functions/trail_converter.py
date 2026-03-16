"""Helper functions to bridge old GPX-based system with new Firestore Trail models."""

import hashlib
import math
from datetime import UTC, datetime

import gpxpy
import gpxpy.gpx

from api.models.trail import Coordinate, TrailBounds, TrailResponse
from app.functions.tracks import simplify_track_coordinates

_MIN_TIMESTAMPS_FOR_DURATION = 2
_MIN_HORIZ_DIST_M = 1.0

# Approximate bounding box for Skåne
_SKANE_SOUTH = 55.35
_SKANE_NORTH = 56.45
_SKANE_WEST = 12.75
_SKANE_EAST = 14.45


def detect_source(coordinates: list[tuple[float, float]]) -> str:
    """Auto-detect trail source based on coordinates.

    Returns 'other_trails' if any coordinate falls within Skåne's
    bounding box, otherwise 'world_wide_hikes'.
    """
    for lat, lng in coordinates:
        if _SKANE_SOUTH <= lat <= _SKANE_NORTH and _SKANE_WEST <= lng <= _SKANE_EAST:
            return "other_trails"
    return "world_wide_hikes"


def _compute_elevation_metrics(
    all_coordinates: list[tuple[float, float]], all_elevations: list[float]
) -> tuple[float, float, float | None, float | None]:
    """Compute elevation gain, loss, and inclination from coordinate/elevation data.

    Returns (gain, loss, avg_inclination_deg, max_inclination_deg).
    """
    gain = 0.0
    loss = 0.0
    inclinations: list[float] = []
    for i in range(len(all_coordinates) - 1):
        elev_diff = all_elevations[i + 1] - all_elevations[i]
        if elev_diff > 0:
            gain += elev_diff
        else:
            loss += abs(elev_diff)
        lat1, lng1 = all_coordinates[i]
        lat2, lng2 = all_coordinates[i + 1]
        lat_diff_m = (lat2 - lat1) * 111_000.0
        lng_diff_m = (lng2 - lng1) * 111_000.0 * math.cos(math.radians(lat1))
        horiz_dist = (lat_diff_m**2 + lng_diff_m**2) ** 0.5
        if horiz_dist > _MIN_HORIZ_DIST_M:
            inclinations.append(math.degrees(math.atan2(abs(elev_diff), horiz_dist)))

    avg_incl = round(sum(inclinations) / len(inclinations), 1) if inclinations else None
    max_incl = round(max(inclinations), 1) if inclinations else None
    return round(gain, 1), round(loss, 1), avg_incl, max_incl


def _extract_duration(all_timestamps: list) -> int | None:
    """Extract duration in minutes from first/last GPX timestamps."""
    if len(all_timestamps) < _MIN_TIMESTAMPS_FOR_DURATION:
        return None
    time_delta = all_timestamps[-1] - all_timestamps[0]
    total_minutes = int(time_delta.total_seconds() / 60)
    return total_minutes if total_minutes > 0 else None


def gpx_track_to_trail(
    gpx_track: gpxpy.gpx.GPXTrack,
    source: str,
    index: int = 0,
    status: str = "To Explore",
    gpx_metadata: dict | None = None,
) -> TrailResponse:
    """Convert a GPX track to a TrailResponse object.

    Args:
        gpx_track: GPXTrack object from gpxpy
        source: Source identifier ("skaneleden", "other_trails", "world_wide_hikes")
        index: Track index (for creating stable IDs)
        status: Current status of the trail
        gpx_metadata: Optional metadata dict with 'time' and other GPX-level info

    Returns:
        TrailResponse object ready for Firestore storage
    """
    # Extract all coordinates, elevation data, and timestamps from all segments
    all_coordinates = []
    all_elevations = []
    all_coordinates_3d = []
    all_timestamps = []
    for segment in gpx_track.segments:
        for point in segment.points:
            all_coordinates.append((point.latitude, point.longitude))
            if point.elevation is not None:
                all_elevations.append(point.elevation)
                all_coordinates_3d.append((point.latitude, point.longitude, point.elevation))
            else:
                all_coordinates_3d.append((point.latitude, point.longitude, 0.0))
            if point.time is not None:
                all_timestamps.append(point.time)

    if not all_coordinates:
        msg = f"Track '{gpx_track.name}' has no coordinates"
        raise ValueError(msg)

    # Use 3D coordinates for simplification when elevation is available
    has_elevation = len(all_elevations) == len(all_coordinates) and len(all_elevations) > 0
    coords_for_simplification = all_coordinates_3d if has_elevation else all_coordinates

    # Simplify coordinates to fit Firestore 1MB limit (~500-750 points for large trails)
    # Lower tolerance = more points. Adjusted to balance detail vs. document size.
    simplified_coords = simplify_track_coordinates(coords_for_simplification, tolerance=0.00001)

    # Calculate bounds
    lats = [lat for lat, _ in all_coordinates]
    lngs = [lng for _, lng in all_coordinates]
    bounds = TrailBounds(north=max(lats), south=min(lats), east=max(lngs), west=min(lngs))

    # Calculate center
    center = Coordinate(lat=sum(lats) / len(lats), lng=sum(lngs) / len(lngs))

    # Calculate approximate length (sum of distances between consecutive points)
    length_km = 0.0
    for i in range(len(all_coordinates) - 1):
        lat1, lng1 = all_coordinates[i]
        lat2, lng2 = all_coordinates[i + 1]
        # Simple Euclidean distance approximation in km
        # (1 degree ≈ 111 km at equator, less at higher latitudes)
        lat_diff = (lat2 - lat1) * 111.0
        lng_diff = (lng2 - lng1) * 111.0 * math.cos(math.radians(lat1))
        length_km += (lat_diff**2 + lng_diff**2) ** 0.5

    # Calculate elevation gain/loss and inclination if elevation data available
    elevation_gain = None
    elevation_loss = None
    avg_inclination_deg = None
    max_inclination_deg = None
    if len(all_elevations) > 1 and has_elevation:
        elevation_gain, elevation_loss, avg_inclination_deg, max_inclination_deg = _compute_elevation_metrics(
            all_coordinates, all_elevations
        )

    # Extract duration from GPX timestamps (first to last point)
    duration_minutes = _extract_duration(all_timestamps)

    # Extract activity metadata from GPX
    activity_date = None
    activity_type = gpx_track.type  # Garmin includes activity type in track
    if gpx_metadata and "time" in gpx_metadata:
        activity_date = gpx_metadata["time"]

    # Generate stable trail_id from track name, index, and first coordinate
    # Include first coordinate to ensure uniqueness across files with same track names
    name = gpx_track.name or f"Unnamed Trail {index}"
    first_coord = f"{all_coordinates[0][0]:.6f},{all_coordinates[0][1]:.6f}"
    trail_id = hashlib.md5(f"{source}_{name}_{index}_{first_coord}".encode()).hexdigest()[:12]  # noqa: S324

    # Build coordinates_map with elevation when available
    if has_elevation:
        coordinates_map = [Coordinate(lat=lat, lng=lng, elevation=elev) for lat, lng, elev in simplified_coords]
    else:
        coordinates_map = [Coordinate(lat=lat, lng=lng) for lat, lng in simplified_coords]

    return TrailResponse(
        trail_id=trail_id,
        name=name,
        difficulty="Unknown",  # GPX doesn't typically have difficulty
        length_km=round(length_km, 2),
        status=status,
        coordinates_map=coordinates_map,
        bounds=bounds,
        center=center,
        source=source,
        last_updated=datetime.now(UTC).isoformat(),
        activity_date=activity_date,
        activity_type=activity_type,
        elevation_gain=elevation_gain,
        elevation_loss=elevation_loss,
        duration_minutes=duration_minutes,
        avg_inclination_deg=avg_inclination_deg,
        max_inclination_deg=max_inclination_deg,
    )


def load_trails_from_gpx_data(
    gpx_data: gpxpy.gpx.GPX | None, source: str, existing_statuses: dict[int, str] | None = None
) -> list[TrailResponse]:
    """Convert GPX data to list of TrailResponse objects.

    Args:
        gpx_data: Parsed GPX data
        source: Source identifier
        existing_statuses: Optional dict mapping track index to status

    Returns:
        List of TrailResponse objects
    """
    if not gpx_data:
        return []

    existing_statuses = existing_statuses or {}
    trails = []

    for i, track in enumerate(gpx_data.tracks):
        status = existing_statuses.get(i, "To Explore")
        try:
            trail = gpx_track_to_trail(track, source, index=i, status=status)
            trails.append(trail)
        except ValueError:
            # Skip tracks with no coordinates
            continue

    return trails
