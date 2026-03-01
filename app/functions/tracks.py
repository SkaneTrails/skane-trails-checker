import logging
from typing import TYPE_CHECKING, TypedDict

import geopy.distance

try:
    from app.resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE
except ModuleNotFoundError:
    from resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.functions.trail_models import Trail

# Constants
MIN_POINTS_FOR_SIMPLIFICATION = 2  # Minimum points needed for RDP algorithm
METERS_PER_KM = 1000  # Conversion factor


class TrackMetadata(TypedDict):
    """Metadata computed for a track."""

    distance_km: float
    segment_count: int
    point_count: int


class TrackInfo(TypedDict, total=False):
    """Complete information about a track for filtering."""

    track_index: int
    name: str
    segments: list[list[tuple[float, float]]]
    status: str
    distance_km: float
    source: str  # "skaneleden" or "additional"


def calculate_track_distance(segments: list[list[tuple[float, float]]]) -> TrackMetadata:
    """Calculate total distance of a track from its segments.

    Args:
        segments: List of segments, where each segment is a list of (lat, lng) tuples

    Returns:
        TrackMetadata with distance in km, segment count, and total point count

    """
    total_distance_meters = 0.0
    total_points = 0

    for segment in segments:
        total_points += len(segment)
        # Calculate distance between consecutive points in the segment
        for i in range(len(segment) - 1):
            point1 = segment[i]
            point2 = segment[i + 1]
            distance = geopy.distance.geodesic(point1, point2).meters
            total_distance_meters += distance

    return {
        "distance_km": round(total_distance_meters / METERS_PER_KM, 2),
        "segment_count": len(segments),
        "point_count": total_points,
    }


def get_distance_range(tracks: list[TrackInfo]) -> tuple[float, float]:
    """Get the min and max distances from a list of tracks.

    Args:
        tracks: List of TrackInfo dictionaries

    Returns:
        Tuple of (min_distance, max_distance) in km

    """
    if not tracks:
        return (DEFAULT_MIN_DISTANCE, DEFAULT_MAX_DISTANCE)

    distances = [t["distance_km"] for t in tracks]
    return (min(distances), max(distances))


def filter_trails(  # noqa: PLR0913
    trails: "list[Trail]",
    *,
    search_query: str = "",
    min_distance_km: float = DEFAULT_MIN_DISTANCE,
    max_distance_km: float = DEFAULT_MAX_DISTANCE,
    show_explored_only: bool = False,
    show_unexplored_only: bool = False,
) -> "list[Trail]":
    """Filter Trail objects based on various criteria.

    Args:
        trails: List of Trail objects to filter
        search_query: Text to search for in trail names (case-insensitive)
        min_distance_km: Minimum trail distance in km
        max_distance_km: Maximum trail distance in km
        show_explored_only: If True, only show trails with "Explored!" status
        show_unexplored_only: If True, only show trails with "To Explore" status

    Returns:
        Filtered list of Trail objects

    """
    filtered = trails

    # Filter by search query (case-insensitive)
    if search_query:
        query_lower = search_query.lower()
        filtered = [t for t in filtered if query_lower in t.name.lower()]

    # Filter by distance range (skip for planned_hikes - official Skåneleden trails)
    filtered = [t for t in filtered if t.source == "planned_hikes" or min_distance_km <= t.length_km <= max_distance_km]

    # Filter by exploration status
    if show_explored_only:
        filtered = [t for t in filtered if t.status == "Explored!"]
    elif show_unexplored_only:
        filtered = [t for t in filtered if t.status == "To Explore"]

    return filtered


def simplify_track_coordinates(coordinates: list, tolerance: float = 0.0001) -> list:
    """Simplify track coordinates using the Ramer-Douglas-Peucker algorithm.

    Args:
        coordinates: List of (latitude, longitude) points
        tolerance: Higher values result in more simplification

    Returns:
        Simplified list of coordinates

    """
    try:
        import numpy as np
        from rdp import rdp

        if len(coordinates) <= MIN_POINTS_FOR_SIMPLIFICATION:
            return coordinates

        # Convert 2D coordinates to 3D (add z=0) for NumPy 2.0 compatibility
        # NumPy 2.0 deprecated 2D vectors in cross-product calculations
        points_3d = np.array([(lat, lon, 0.0) for lat, lon in coordinates])

        # Apply RDP simplification
        simplified_3d = rdp(points_3d, epsilon=tolerance)

        # Convert back to 2D by removing the z coordinate
        return [(lat, lon) for lat, lon, _ in simplified_3d.tolist()]
    except ImportError:
        logger.warning("To enable track simplification, install rdp: uv add rdp")
        return coordinates
