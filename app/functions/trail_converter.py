"""Helper functions to bridge old GPX-based system with new Firestore Trail models."""

import hashlib
from datetime import UTC, datetime

import gpxpy
import gpxpy.gpx

from api.models.trail import Coordinate, TrailBounds, TrailResponse
from app.functions.tracks import simplify_track_coordinates


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
    # Extract all coordinates and elevation data from all segments
    all_coordinates = []
    all_elevations = []
    for segment in gpx_track.segments:
        for point in segment.points:
            all_coordinates.append((point.latitude, point.longitude))
            if point.elevation is not None:
                all_elevations.append(point.elevation)

    if not all_coordinates:
        msg = f"Track '{gpx_track.name}' has no coordinates"
        raise ValueError(msg)

    # Simplify coordinates to fit Firestore 1MB limit (~500-750 points for large trails)
    # Lower tolerance = more points. Adjusted to balance detail vs. document size.
    simplified_coords = simplify_track_coordinates(all_coordinates, tolerance=0.00001)

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
        lng_diff = (lng2 - lng1) * 111.0 * abs(lat1 / 90.0)  # Latitude correction
        length_km += (lat_diff**2 + lng_diff**2) ** 0.5

    # Calculate elevation gain/loss if elevation data available
    elevation_gain = None
    elevation_loss = None
    if len(all_elevations) > 1:
        gain = 0.0
        loss = 0.0
        for i in range(len(all_elevations) - 1):
            diff = all_elevations[i + 1] - all_elevations[i]
            if diff > 0:
                gain += diff
            else:
                loss += abs(diff)
        elevation_gain = round(gain, 1)
        elevation_loss = round(loss, 1)

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

    return TrailResponse(
        trail_id=trail_id,
        name=name,
        difficulty="Unknown",  # GPX doesn't typically have difficulty
        length_km=round(length_km, 2),
        status=status,
        coordinates_map=[Coordinate(lat=lat, lng=lng) for lat, lng in simplified_coords],
        bounds=bounds,
        center=center,
        source=source,
        last_updated=datetime.now(UTC).isoformat(),
        activity_date=activity_date,
        activity_type=activity_type,
        elevation_gain=elevation_gain,
        elevation_loss=elevation_loss,
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
