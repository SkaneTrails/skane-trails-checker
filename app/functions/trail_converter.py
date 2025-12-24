"""Helper functions to bridge old GPX-based system with new Firestore Trail models."""

import hashlib
from datetime import UTC, datetime

import gpxpy
from functions.trail_models import Trail, TrailBounds, TrailCenter
from functions.tracks import simplify_track_coordinates


def gpx_track_to_trail(gpx_track: gpxpy.gpx.GPXTrack, source: str, index: int = 0, status: str = "To Explore") -> Trail:
    """Convert a GPX track to a Trail object.
    
    Args:
        gpx_track: GPXTrack object from gpxpy
        source: Source identifier ("skaneleden", "other_trails", "world_wide_hikes")
        index: Track index (for creating stable IDs)
        status: Current status of the trail
        
    Returns:
        Trail object ready for Firestore storage
    """
    # Extract all coordinates from all segments
    all_coordinates = []
    for segment in gpx_track.segments:
        coords = [(point.latitude, point.longitude) for point in segment.points]
        all_coordinates.extend(coords)
    
    if not all_coordinates:
        raise ValueError(f"Track '{gpx_track.name}' has no coordinates")
    
    # Simplify coordinates to fit Firestore 1MB limit (~500-750 points for large trails)
    # Lower tolerance = more points. Adjusted to balance detail vs. document size.
    simplified_coords = simplify_track_coordinates(all_coordinates, tolerance=0.0001)
    
    # Calculate bounds
    lats = [lat for lat, _ in all_coordinates]
    lngs = [lng for _, lng in all_coordinates]
    bounds = TrailBounds(
        north=max(lats),
        south=min(lats),
        east=max(lngs),
        west=min(lngs),
    )
    
    # Calculate center
    center = TrailCenter(
        lat=sum(lats) / len(lats),
        lng=sum(lngs) / len(lngs),
    )
    
    # Calculate approximate length (sum of distances between consecutive points)
    length_km = 0.0
    for i in range(len(all_coordinates) - 1):
        lat1, lng1 = all_coordinates[i]
        lat2, lng2 = all_coordinates[i + 1]
        # Simple Euclidean distance approximation in km
        # (1 degree ≈ 111 km at equator, less at higher latitudes)
        lat_diff = (lat2 - lat1) * 111.0
        lng_diff = (lng2 - lng1) * 111.0 * abs(lat1 / 90.0)  # Latitude correction
        length_km += (lat_diff ** 2 + lng_diff ** 2) ** 0.5
    
    # Generate stable trail_id from track name and index
    name = gpx_track.name or f"Unnamed Trail {index}"
    trail_id = hashlib.md5(f"{source}_{name}_{index}".encode()).hexdigest()[:12]
    
    return Trail(
        trail_id=trail_id,
        name=name,
        difficulty="Unknown",  # GPX doesn't typically have difficulty
        length_km=round(length_km, 2),
        status=status,
        coordinates_map=simplified_coords,
        bounds=bounds,
        center=center,
        source=source,
        last_updated=datetime.now(UTC).isoformat(),
    )


def load_trails_from_gpx_data(gpx_data: gpxpy.gpx.GPX | None, source: str, existing_statuses: dict[int, str] | None = None) -> list[Trail]:
    """Convert GPX data to list of Trail objects.
    
    Args:
        gpx_data: Parsed GPX data
        source: Source identifier
        existing_statuses: Optional dict mapping track index to status
        
    Returns:
        List of Trail objects
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
        except ValueError as e:
            # Skip tracks with no coordinates
            continue
    
    return trails
