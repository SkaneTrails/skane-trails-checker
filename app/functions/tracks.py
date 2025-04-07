import os
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import streamlit as st


def simplify_track_coordinates(coordinates, tolerance=0.0001):
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

        if len(coordinates) <= 2:
            return coordinates

        # Convert to numpy array for rdp algorithm
        points = np.array(coordinates)
        # Apply simplification
        simplified = rdp(points, epsilon=tolerance)

        return simplified.tolist()
    except ImportError:
        st.warning("To enable track simplification, install rdp: pip install rdp")
        return coordinates


# Load track statuses from CSV file if it exists
def load_track_statuses(skaneleden_status):
    if Path.exists(skaneleden_status):
        try:
            status_df = pd.read_csv(skaneleden_status)
            track_status = {}
            for _, row in status_df.iterrows():
                track_status[int(row["track_id"])] = row["status"]
            return track_status
        except Exception as e:
            st.warning(f"Error loading track statuses: {e}")
            return {}
    return {}


# Save track statuses to CSV file
def save_track_statuses(track_status, skaneleden_status) -> bool:
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
        Path.mkdir(os.path.dirname(skaneleden_status), exist_ok=True)

        status_df = pd.DataFrame(data)
        status_df.to_csv(skaneleden_status, index=False)
        return True

    except Exception as e:
        st.error(f"Error saving track statuses: {e}")
        return False
