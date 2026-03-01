import logging
import tempfile
from pathlib import Path
from typing import Any, TypedDict

import gpxpy

from api.storage.trail_storage import save_trail
from app.functions.trail_converter import gpx_track_to_trail

logger = logging.getLogger(__name__)


class TrackData(TypedDict):
    """Structure for track data."""

    name: str
    file: str
    segments: list[list[tuple[float, float]]]


def load_additional_gpx_files(directory: Path | str) -> list[dict]:
    # Function to load additional GPX files
    additional_tracks = []
    dir_path = Path(directory)

    # Check if directory exists
    if not dir_path.exists():
        return additional_tracks

    # Find all GPX files in the directory
    gpx_files = list(dir_path.glob("*.gpx"))

    for file_path in gpx_files:
        try:
            with file_path.open(encoding="utf-8") as gpx_file:
                gpx_string = gpx_file.read()
                gpx_data = gpxpy.parse(gpx_string)
                file_name = file_path.name

                # Extract all tracks from this file
                for track in gpx_data.tracks:
                    track_data: TrackData = {"name": track.name or file_name, "file": file_name, "segments": []}

                    for segment in track.segments:
                        coordinates = [(point.latitude, point.longitude) for point in segment.points]
                        if coordinates:
                            track_data["segments"].append(coordinates)

                    if track_data["segments"]:
                        additional_tracks.append(track_data)
        except Exception:
            logger.exception("Error loading additional GPX file %s", file_path)

    return additional_tracks


def handle_uploaded_gpx(uploaded_file: Any, *, is_world_wide: bool = False) -> tuple[bool, str]:
    """Upload GPX file and save trails to Firestore (no disk storage).

    Args:
        uploaded_file: File-like object with name and getvalue() method
        is_world_wide: Whether this is a world-wide hike or local trail

    Returns:
        Tuple of (success, message)
    """
    logger.info("Processing GPX file: %s", uploaded_file.name)
    tmp_file_path = None  # Initialize to None for cleanup in except block
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            # Write the uploaded file content to the temporary file
            tmp_file.write(uploaded_file.getvalue())
            tmp_file_path = Path(tmp_file.name)

        # Try to parse the GPX file to validate it
        with tmp_file_path.open(encoding="utf-8") as test_file:
            gpx_string = test_file.read()
            gpx_data = gpxpy.parse(gpx_string)  # This will raise an exception if the file is invalid

        logger.info("GPX valid, found %d tracks", len(gpx_data.tracks))

        # Clean up temporary file
        tmp_file_path.unlink()

        # Save trails to Firestore (no longer saving to disk)
        source = "world_wide_hikes" if is_world_wide else "other_trails"
        logger.info("Saving to Firestore with source: %s", source)

        # Extract metadata from GPX file (activity date/time)
        gpx_metadata = {}
        if gpx_data.time:
            gpx_metadata["time"] = gpx_data.time.isoformat()

        saved_count = 0
        for i, track in enumerate(gpx_data.tracks):
            try:
                # Convert GPX track to Trail object with metadata
                # Uploaded hikes are marked as "Explored!" since they've already been done
                trail = gpx_track_to_trail(track, source=source, index=i, status="Explored!", gpx_metadata=gpx_metadata)

                # Save simplified trail for map display
                save_trail(trail)
                saved_count += 1

            except Exception:
                logger.exception("Failed to save track '%s' to Firestore", track.name)

        msg = f"Successfully uploaded {uploaded_file.name} and saved {saved_count} trail(s) to Firestore"
        logger.info(msg)
        return True, msg

    except Exception as e:
        msg = f"Error uploading file: {e}"
        logger.exception(msg)
        if tmp_file_path and tmp_file_path.exists():
            tmp_file_path.unlink()  # Clean up temp file if it exists
        return False, msg
