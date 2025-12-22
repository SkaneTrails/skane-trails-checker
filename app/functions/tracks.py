from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import streamlit as st

# Constants
MIN_POINTS_FOR_SIMPLIFICATION = 2  # Minimum points needed for RDP algorithm


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
