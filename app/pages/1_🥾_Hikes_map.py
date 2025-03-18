import streamlit as st
import gpxpy
import folium
from streamlit_folium import st_folium
import geopy.distance
import os
import pandas as pd
import csv
from datetime import datetime
import glob
import tempfile
import shutil
import os
import pathlib


# Set page config to wide mode for full-width layout
st.set_page_config(layout="wide")
# Inject custom CSS for larger tabs
st.markdown(
    """
    <style>
    .sidebar .stTitle {
        font-size: 18px !important; /* Adjust size as needed */
    }
    .stTabs button {
        padding: 12px 24px !important;
        font-size: 20px !important; /
    }
    </style>
    """,
    unsafe_allow_html=True
)


st.title("🥾 Skåne Trails Explorer & Future Improvements")

# Create tabs
tab1, tab2 = st.tabs(["Map and trails 🌍", "🚀 Possible Improvements"])

# Main GPX Explorer Tab
with tab1:
    # Use columns to create a sidebar-like layout while maintaining full width for the map
    col1, col2 = st.columns([1, 4], gap="large") # 1:4 ratio gives 20% width to stats, 80% to map

    with col1:
        # 🎨 Streamlit App Title (in the sidebar)
        st.title("Skåne map and trails 🌍")
    
    # Define file paths (use relative paths for better portability)
    cur_dir = pathlib.Path(__file__).parent.parent.absolute()
    data_directory = cur_dir
    # Create data directory if it doesn't exist
    os.makedirs(data_directory, exist_ok=True)

    # Define the path to the GPX file and CSV file
    gpx_file_path = os.path.join(data_directory,"tracks_gpx/skaneleden/all-skane-trails.gpx")  # Main GPX file
    gpx_other_files_path = os.path.join(data_directory,"tracks_gpx/other_trails/")  # Directory with other trails
    skaneleden_status = os.path.join(data_directory,"tracks_status/track_skaneleden_status.csv")  # Path for saving track statuses

    # Create directories if they don't exist
    os.makedirs(os.path.dirname(skaneleden_status), exist_ok=True)
    os.makedirs(gpx_other_files_path, exist_ok=True)

# Load track statuses from CSV file if it exists
def load_track_statuses():
    if os.path.exists(skaneleden_status):
        try:
            status_df = pd.read_csv(skaneleden_status)
            track_status = {}
            for _, row in status_df.iterrows():
                track_status[int(row['track_id'])] = row['status']
            return track_status
        except Exception as e:
            st.warning(f"Error loading track statuses: {e}")
            return {}
    return {}

# Save track statuses to CSV file
def save_track_statuses(track_status):
    try:
        data = []
        for track_id, status in track_status.items():
            data.append({
                'track_id': track_id,
                'status': status,
                'last_updated': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(skaneleden_status), exist_ok=True)
        
        status_df = pd.DataFrame(data)
        status_df.to_csv(skaneleden_status, index=False)
        return True
    except Exception as e:
        st.error(f"Error saving track statuses: {e}")
        return False

# Function to load additional GPX files
def load_additional_gpx_files(directory):
    additional_tracks = []
    
    # Check if directory exists
    if not os.path.exists(directory):
        return additional_tracks
    
    # Find all GPX files in the directory
    gpx_files = glob.glob(os.path.join(directory, "*.gpx"))
    
    for file_path in gpx_files:
        try:
            with open(file_path, "r", encoding="utf-8") as gpx_file:
                gpx_string = gpx_file.read()
                gpx_data = gpxpy.parse(gpx_string)
                file_name = os.path.basename(file_path)
                
                # Extract all tracks from this file
                for track in gpx_data.tracks:
                    track_data = {
                        "name": track.name or file_name,
                        "file": file_name,
                        "segments": []
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
def handle_uploaded_gpx(uploaded_file):
    try:
        # Save the uploaded file to the other_trails directory
        file_path = os.path.join(gpx_other_files_path, uploaded_file.name)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            # Write the uploaded file content to the temporary file
            tmp_file.write(uploaded_file.getvalue())
            tmp_file_path = tmp_file.name
        
        # Try to parse the GPX file to validate it
        with open(tmp_file_path, "r", encoding="utf-8") as test_file:
            gpx_string = test_file.read()
            gpxpy.parse(gpx_string)  # This will raise an exception if the file is invalid
            
        # If parsing succeeded, copy the file to the destination
        shutil.copy(tmp_file_path, file_path)
        os.unlink(tmp_file_path)  # Remove the temporary file
        
        # Reload additional tracks
        st.session_state.additional_tracks = load_additional_gpx_files(gpx_other_files_path)
        
        return True, f"Successfully uploaded {uploaded_file.name}"
    except Exception as e:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)  # Clean up temp file if it exists
        return False, f"Error uploading file: {e}"

# 📂 Load GPX file from folder
if "gpx_data" not in st.session_state:
    if os.path.exists(gpx_file_path):
        with open(gpx_file_path, "r", encoding="utf-8") as gpx_file:
            gpx_string = gpx_file.read()  # Read file as string
            st.session_state.gpx_data = gpxpy.parse(gpx_string)
            st.session_state.file_loaded = True

            # Load track statuses from CSV or initialize new
            if "track_status" not in st.session_state:
                st.session_state.track_status = load_track_statuses()

            # Assign "To Explore" to all tracks if not already set
            for i in range(len(st.session_state.gpx_data.tracks)):
                if i not in st.session_state.track_status:
                    st.session_state.track_status[i] = "To Explore"
            
            # Save initial statuses if needed
            save_track_statuses(st.session_state.track_status)
            
            # Load additional completed trails
            st.session_state.additional_tracks = load_additional_gpx_files(gpx_other_files_path)
    else:
        st.session_state.file_loaded = False
        st.error(f"File not found: {gpx_file_path}")
        st.session_state.additional_tracks = []

# Display statistics and upload button in the left column
with tab1:
    with col1:
        if st.session_state.get("file_loaded", False):
            st.header("Track Statistics")
            
            # We'll calculate these later after we process the tracks
            if "track_coordinates" in st.session_state:
                total_tracks = len(st.session_state.track_coordinates)
                explored_tracks = sum(1 for status in st.session_state.track_status.values() if status == "Explored!")
                additional_tracks_count = len(st.session_state.additional_tracks)
                
                # Count segments in additional tracks
                additional_segments_count = sum(len(track["segments"]) for track in st.session_state.additional_tracks)
                
                st.metric("Main Tracks", total_tracks)
                st.metric("Explored Main Tracks", explored_tracks)
                st.metric("Completion Rate", f"{int((explored_tracks/total_tracks)*100)}%" if total_tracks > 0 else "0%")
                st.metric("Additional Completed Trails", additional_tracks_count)
            
            # Display a button to manually save status
            if st.button("Save Track Status"):
                if save_track_statuses(st.session_state.track_status):
                    st.success("Track statuses saved successfully!")
            
            # Add GPX upload section instead of listing all additional trails
            st.subheader("Upload Additional Trails")
            uploaded_file = st.file_uploader("Upload GPX file", type=['gpx'])
            
            # Handle file upload
            if uploaded_file is not None:
                success, message = handle_uploaded_gpx(uploaded_file)
                if success:
                    st.success(message)
                    # Force refresh to show new track
                    st.rerun()
                else:
                    st.error(message)
        else:
            st.info("Please upload a GPX file to view the trail.")

    # Display Map in the right column if file is loaded
    with col2:
        if st.session_state.get("file_loaded", False):
            gpx = st.session_state.gpx_data

            # 🗺️ Get all track coordinates to center map
            all_coords = []
            track_coordinates = {}  # Store track coordinates

            track_index = 0  # Ensuring unique track index
            for track in gpx.tracks:
                for segment in track.segments:
                    coordinates = [(point.latitude, point.longitude) for point in segment.points]

                    if coordinates:
                        track_coordinates[track_index] = coordinates  # Store for click detection
                        all_coords.extend(coordinates)  # Collect for centering

                        track_index += 1
            
            # Add coordinates from additional tracks for map centering
            for track in st.session_state.additional_tracks:
                for segment in track["segments"]:
                    all_coords.extend(segment)
            
            # Store track coordinates in session state for the stats panel
            st.session_state.track_coordinates = track_coordinates

            # Compute map center & zoom
            if all_coords:
                avg_lat = sum(lat for lat, lon in all_coords) / len(all_coords)
                avg_lon = sum(lon for lat, lon in all_coords) / len(all_coords)
                m = folium.Map(location=[avg_lat, avg_lon], zoom_start=10)  # 🔍 Center & zoom dynamically
            else:
                m = folium.Map(zoom_start=10)

            # Plot main tracks (Skåneleden) with the new color scheme: orange to dark green
            for track_index, coordinates in track_coordinates.items():
                track_status = st.session_state.track_status.get(track_index, "To Explore")
                # Orange for to explore, dark green for explored
                track_color = "#FF8C00" if track_status == "To Explore" else "#006400"  # Orange → Dark Green

                folium.PolyLine(
                    coordinates, 
                    color=track_color, 
                    weight=5, 
                    opacity=0.7,
                    popup=f"Track {track_index}: {track_status}",
                    tooltip="Click near this track!"
                ).add_to(m)

                # Start and End Points with matching colors
                for point in [coordinates[0], coordinates[-1]]:  
                    folium.CircleMarker(
                        location=point,
                        radius=6,
                        color=track_color,
                        fill=True,
                        fill_color=track_color,
                        fill_opacity=0.9
                    ).add_to(m)
            
            # Plot additional completed tracks with dark green dashed lines
            for i, track in enumerate(st.session_state.additional_tracks):
                for segment in track["segments"]:
                    # Create a dashed line for completed additional tracks (always dark green)
                    folium.PolyLine(
                        segment,
                        color="#2683b5",  # Dark Green color
                        weight=4,
                        opacity=0.8,
                        popup=f"Additional Trail: {track['name']}",
                        tooltip=f"Completed: {track['name']}"
                    ).add_to(m)
                    
                    # Add circle markers for start and end
                    for point in [segment[0], segment[-1]]:
                        folium.CircleMarker(
                            location=point,
                            radius=5,
                            color="#2683b5",  # Dark Green color
                            fill=True,
                            fill_color="#2683b5",
                            fill_opacity=0.8,
                            popup=f"Additional Trail: {track['name']}"
                        ).add_to(m)

            # Enable ClickForMarker (lets us detect clicks on the map)
            m.add_child(folium.LatLngPopup())

            # Get the screen height (approximated)
            map_height = 800  # Larger default height

            # Display the interactive map with full width and calculated height
            map_data = st_folium(m, height=map_height, width="100%", key="map")

            # Handle User Click
            if map_data and "last_clicked" in map_data and map_data["last_clicked"] is not None:
                clicked_latlng = (map_data["last_clicked"]["lat"], map_data["last_clicked"]["lng"])

                # Find the closest track segment to the clicked location
                closest_track = None
                min_distance = float("inf")

                for track_idx, coordinates in track_coordinates.items():
                    for point in coordinates:
                        distance = geopy.distance.geodesic(clicked_latlng, point).meters
                        if distance < min_distance:
                            min_distance = distance
                            closest_track = track_idx

                # Toggle track status if within 50 meters
                if closest_track is not None and min_distance < 50:  # Click range set to 50m
                    current_status = st.session_state.track_status.get(closest_track, "To Explore")

                    # ✅ Toggle between "To Explore" and "Explored!"
                    new_status = "Explored!" if current_status == "To Explore" else "To Explore"
                    st.session_state.track_status[closest_track] = new_status

                    # Save the updated status to CSV
                    save_success = save_track_statuses(st.session_state.track_status)
                    
                    # 🔥 Pop-up message
                    if save_success:
                        st.success(f"✅ Track {closest_track} has been marked as '{new_status}' and saved!")
                    else:
                        st.success(f"✅ Track {closest_track} has been marked as '{new_status}' but couldn't be saved.")

                    # 🚀 Force UI refresh to update map color
                    st.rerun()
    
# Possible Improvements Tab
with tab2:
    st.title("🚀 Possible Improvements")
    improvements = [
        "Trail Filtering & Search: Filter/search trails by difficulty, length, location.",
        "Elevation Profile: Show elevation charts for climbs and descents.",
        "Trail Details Panel: Display distance, estimated time, difficulty, highest point.",
        "Trail Photos: Upload and view photos from specific trail points.",
        "Trail Combining: Combine multiple segments into a custom route.",
        "Trail Ratings/Reviews: Allow users to rate and review trails.",
        "Nearby Points of Interest: Show parking areas, fireplaces, shelters, restrooms, water sources, viewpoints.",
        "Trail Condition Reports: Report/view trail conditions (muddy, fallen trees, etc.).",
        "Trail Statistics Dashboard: Visual stats of user's hiking history (distance, elevation gain, etc.)."
    ]
    for improvement in improvements:
        parts = improvement.split(":", 1)  # Split into two parts at the first colon
        if len(parts) == 2:
            title, description = parts
            st.markdown(f"<p style='font-size:18px;'><b>{title}:</b>{description}</p>", unsafe_allow_html=True)
        else:
            st.markdown(f"<p style='font-size:18px;'><b>{improvement}</b></p>", unsafe_allow_html=True)
