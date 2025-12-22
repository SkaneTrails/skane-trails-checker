import glob
import os
import shutil
import tempfile

import gpxpy
import streamlit as st


def load_additional_gpx_files(directory):
    # Function to load additional GPX files
    additional_tracks = []

    # Check if directory exists
    if not os.path.exists(directory):
        return additional_tracks

    # Find all GPX files in the directory
    gpx_files = glob.glob(os.path.join(directory, "*.gpx"))

    for file_path in gpx_files:
        try:
            with open(file_path, encoding="utf-8") as gpx_file:
                print(f"Loading {gpx_file}")
                gpx_string = gpx_file.read()
                gpx_data = gpxpy.parse(gpx_string)
                file_name = os.path.basename(file_path)

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
def handle_uploaded_gpx(world_wide_hikes_path, skane_other_files_path, uploaded_file, is_world_wide=False):
    try:
        if is_world_wide:
            file_path = os.path.join(world_wide_hikes_path, uploaded_file.name)
        else:
            # Save the uploaded file to the other_trails directory
            file_path = os.path.join(skane_other_files_path, uploaded_file.name)

        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            # Write the uploaded file content to the temporary file
            tmp_file.write(uploaded_file.getvalue())
            tmp_file_path = tmp_file.name

        # Try to parse the GPX file to validate it
        with open(tmp_file_path, encoding="utf-8") as test_file:
            print(f"Validating {test_file}")
            gpx_string = test_file.read()
            gpxpy.parse(gpx_string)  # This will raise an exception if the file is invalid

        # If parsing succeeded, copy the file to the destination
        shutil.copy(tmp_file_path, file_path)
        os.unlink(tmp_file_path)  # Remove the temporary file

        # Reload additional tracks
        # st.session_state.additional_tracks = load_additional_gpx_files(skane_other_files_path)

        return True, f"Successfully uploaded {uploaded_file.name}"

    except Exception as e:
        if os.path.exists(tmp_file_path):
            os.path.unlink(tmp_file_path)  # Clean up temp file if it exists
        return False, f"Error uploading file: {e}"
