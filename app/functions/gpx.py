import shutil
import tempfile
from pathlib import Path
from typing import Any

import gpxpy
import streamlit as st


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
                print(f"Loading {gpx_file}")
                gpx_string = gpx_file.read()
                gpx_data = gpxpy.parse(gpx_string)
                file_name = file_path.name

                # Extract all tracks from this file
                for track in gpx_data.tracks:
                    track_data = {
                        "name": track.name or file_name,
                        "file": file_name,
                        "segments": [],
                    }

                    for segment in track.segments:
                        coordinates = [(point.latitude, point.longitude) for point in segment.points]
                        if coordinates:
                            track_data["segments"].append(coordinates)

                    if track_data["segments"]:
                        additional_tracks.append(track_data)
        except Exception as e:
            st.warning(f"Error loading additional GPX file {file_path}: {e}")

    return additional_tracks


# Function to handle upload of new GPX files
def handle_uploaded_gpx(
    world_wide_hikes_path: Path | str,
    skane_other_files_path: Path | str,
    uploaded_file: Any,  # st.runtime.uploaded_file_manager.UploadedFile
    *,
    is_world_wide: bool = False,
) -> tuple[bool, str]:
    world_wide_path = Path(world_wide_hikes_path)
    skane_other_path = Path(skane_other_files_path)

    tmp_file_path = None  # Initialize to None for cleanup in except block
    try:
        file_path = world_wide_path / uploaded_file.name if is_world_wide else skane_other_path / uploaded_file.name

        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            # Write the uploaded file content to the temporary file
            tmp_file.write(uploaded_file.getvalue())
            tmp_file_path = Path(tmp_file.name)

        # Try to parse the GPX file to validate it
        with tmp_file_path.open(encoding="utf-8") as test_file:
            print(f"Validating {test_file}")
            gpx_string = test_file.read()
            gpxpy.parse(gpx_string)  # This will raise an exception if the file is invalid

        # If parsing succeeded, copy the file to the destination
        shutil.copy(tmp_file_path, file_path)
        tmp_file_path.unlink()  # Remove the temporary file

        return True, f"Successfully uploaded {uploaded_file.name}"

    except Exception as e:
        if tmp_file_path and tmp_file_path.exists():
            tmp_file_path.unlink()  # Clean up temp file if it exists
        return False, f"Error uploading file: {e}"
