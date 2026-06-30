"""Bootstrap Skåneleden trails from disk to Firestore on first run."""

from pathlib import Path

import gpxpy
import gpxpy.gpx

from api.storage.firestore_client import get_collection
from api.storage.trail_storage import save_trail
from app.functions.trail_converter import gpx_track_to_trail


def bootstrap_planned_trails(gpx_file_path: Path | str) -> tuple[int, str]:
    """Load planned trails from disk GPX file to Firestore if not already present.

    This function checks if any trails with source="planned_hikes" exist in Firestore.
    If none are found, it loads them from the specified GPX file.

    Args:
        gpx_file_path: Path to the all-skane-trails.gpx file

    Returns:
        Tuple of (trails_loaded, message)
    """
    gpx_path = Path(gpx_file_path)

    print("[Bootstrap] Checking for planned trails in Firestore...")

    # Check if file exists
    if not gpx_path.exists():
        msg = f"Planned trails GPX file not found: {gpx_path}"
        print(f"[Bootstrap] ERROR: {msg}")
        return 0, msg

    # Check if planned trails already exist in Firestore (efficient: just check existence)
    collection = get_collection("trails")
    planned_query = collection.where("source", "==", "planned_hikes").limit(1).stream()
    has_planned_trails = any(True for _ in planned_query)

    if has_planned_trails:
        msg = "Planned trails already in Firestore"
        print(f"[Bootstrap] {msg}")
        return 0, msg

    # Load from disk
    print(f"[Bootstrap] Loading from {gpx_path}...")
    try:
        with gpx_path.open(encoding="utf-8") as gpx_file:
            gpx_string = gpx_file.read()
            gpx_data = gpxpy.parse(gpx_string)

        print(f"[Bootstrap] Found {len(gpx_data.tracks)} tracks in GPX file")

        loaded_count = 0
        for track in gpx_data.tracks:
            # Multi-segment GPX - treat each segment as separate trail
            if len(track.segments) > 1:
                print(f"[Bootstrap] Track '{track.name}' has {len(track.segments)} segments, splitting...")
                for seg_idx, segment in enumerate(track.segments):
                    try:
                        # Create a temporary track with single segment
                        temp_track = gpxpy.gpx.GPXTrack()
                        temp_track.name = f"{track.name} - Segment {seg_idx + 1}"
                        temp_track.segments = [segment]

                        # Convert to Trail object
                        trail = gpx_track_to_trail(temp_track, source="planned_hikes", index=seg_idx)

                        print(f"  [Bootstrap] Saving trail {seg_idx + 1}/{len(track.segments)}: {trail.name}")
                        save_trail(trail)
                        loaded_count += 1
                    except Exception as e:
                        print(f"  [Bootstrap] ERROR: Failed to save segment {seg_idx}: {e}")
                        continue
            else:
                # Single segment track - process normally
                try:
                    trail = gpx_track_to_trail(track, source="planned_hikes", index=0)
                    print(f"  [Bootstrap] Saving trail: {trail.name}")
                    save_trail(trail)
                    loaded_count += 1
                except Exception as e:
                    print(f"  [Bootstrap] ERROR: Failed to save track '{track.name}': {e}")
                    continue

        msg = f"Loaded {loaded_count} Skåneleden trails from disk to Firestore"
        print(f"[Bootstrap] {msg}")
        return loaded_count, msg

    except Exception as e:
        msg = f"Error loading Skåneleden trails: {e}"
        print(f"[Bootstrap] ERROR: {msg}")
        return 0, msg
