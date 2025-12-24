from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict

import geopy.distance
import pandas as pd
import streamlit as st

try:
    from app.resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE
except ModuleNotFoundError:
    from resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE

# Constants
MIN_POINTS_FOR_SIMPLIFICATION = 2  # Minimum points needed for RDP algorithm
METERS_PER_KM = 1000  # Conversion factor


class TrackMetadata(TypedDict):
    """Metadata computed for a track."""

    distance_km: float
    segment_count: int
    point_count: int


class TrackInfo(TypedDict):
    """Complete information about a track for filtering."""

    track_index: int
    name: str
    segments: list[list[tuple[float, float]]]
    status: str
    distance_km: float


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


def filter_tracks(
    tracks: list[TrackInfo],
    *,
    search_query: str = "",
    min_distance_km: float = DEFAULT_MIN_DISTANCE,
    max_distance_km: float = DEFAULT_MAX_DISTANCE,
    show_explored_only: bool = False,
    show_unexplored_only: bool = False,
) -> list[TrackInfo]:
    """Filter tracks based on various criteria.

    Args:
        tracks: List of TrackInfo dictionaries to filter
        search_query: Text to search for in track names (case-insensitive)
        min_distance_km: Minimum track distance in km
        max_distance_km: Maximum track distance in km
        show_explored_only: If True, only show tracks with "Explored!" status
        show_unexplored_only: If True, only show tracks with "To Explore" status

    Returns:
        Filtered list of TrackInfo dictionaries

    """
    filtered = tracks

    # Filter by search query (case-insensitive)
    if search_query:
        query_lower = search_query.lower()
        filtered = [t for t in filtered if query_lower in t["name"].lower()]

    # Filter by distance range
    filtered = [t for t in filtered if min_distance_km <= t["distance_km"] <= max_distance_km]

    # Filter by exploration status
    if show_explored_only:
        filtered = [t for t in filtered if t["status"] == "Explored!"]
    elif show_unexplored_only:
        filtered = [t for t in filtered if t["status"] == "To Explore"]

    return filtered


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
        st.warning("To enable track simplification, install rdp: uv add rdp")
        return coordinates


# Load track statuses from CSV file if it exists
def load_track_statuses(skaneleden_status: Path | str) -> dict[int, str]:
    status_path = Path(skaneleden_status)
    if status_path.exists():
        try:
            status_df = pd.read_csv(status_path)
            track_status = {}
            for _, row in status_df.iterrows():
                track_status[int(row["track_id"])] = row["status"]
            return track_status
        except Exception as e:
            st.warning(f"Error loading track statuses: {e}")
            return {}
    return {}


# Save track statuses to CSV file
def save_track_statuses(track_status: dict[int, str], skaneleden_status: Path | str) -> bool:
    status_path = Path(skaneleden_status)
    try:
        data = []
        for track_id, status in track_status.items():
            data.append(
                {
                    "track_id": track_id,
                    "status": status,
                    "last_updated": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        # Create directory if it doesn't exist
        status_path.parent.mkdir(parents=True, exist_ok=True)

        status_df = pd.DataFrame(data)
        status_df.to_csv(status_path, index=False)
        return True

    except Exception as e:
        st.error(f"Error saving track statuses: {e}")
        return False
