import streamlit as st
import gpxpy
import folium
from streamlit_folium import st_folium
import geopy.distance
import os
import pandas as pd
import csv
from datetime import datetime

# Set page config to wide mode for full-width layout
st.set_page_config(layout="wide")

# Use columns to create a sidebar-like layout while maintaining full width for the map
col1, col2 = st.columns([1, 4])  # 1:4 ratio gives 20% width to stats, 80% to map

with col1:
    # 🎨 Streamlit App Title (in the sidebar)
    st.title("📍 GPX Trail Explorer")

# Define the path to the GPX file and CSV file
gpx_file_path = "experiments/services_scrape/all-skane-trails.gpx"  # Replace with your actual file path
csv_file_path = "experiments/services_scrape/track_status.csv"  # Path for saving track statuses

# Load track statuses from CSV file if it exists
def load_track_statuses():
    if os.path.exists(csv_file_path):
        try:
            status_df = pd.read_csv(csv_file_path)
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
        
        status_df = pd.DataFrame(data)
        status_df.to_csv(csv_file_path, index=False)
        return True
    except Exception as e:
        st.error(f"Error saving track statuses: {e}")
        return False

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
    else:
        st.session_state.file_loaded = False
        st.error(f"File not found: {gpx_file_path}")

# Display statistics in the left column
with col1:
    if st.session_state.get("file_loaded", False):
        st.header("Track Statistics")
        
        # We'll calculate these later after we process the tracks
        if "track_coordinates" in st.session_state:
            total_tracks = len(st.session_state.track_coordinates)
            explored_tracks = sum(1 for status in st.session_state.track_status.values() if status == "Explored!")
            
            st.metric("Total Tracks", total_tracks)
            st.metric("Explored Tracks", explored_tracks)
            st.metric("Completion Rate", f"{int((explored_tracks/total_tracks)*100)}%" if total_tracks > 0 else "0%")
        
        # Display a button to manually save status
        if st.button("Save Track Status"):
            if save_track_statuses(st.session_state.track_status):
                st.success("Track statuses saved successfully!")
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
        
        # Store track coordinates in session state for the stats panel
        st.session_state.track_coordinates = track_coordinates

        # Compute map center & zoom
        if all_coords:
            avg_lat = sum(lat for lat, lon in all_coords) / len(all_coords)
            avg_lon = sum(lon for lat, lon in all_coords) / len(all_coords)
            m = folium.Map(location=[avg_lat, avg_lon], zoom_start=10)  # 🔍 Center & zoom dynamically
        else:
            m = folium.Map(zoom_start=10)

        # Plot tracks
        for track_index, coordinates in track_coordinates.items():
            track_status = st.session_state.track_status.get(track_index, "To Explore")
            track_color = "#3388ff" if track_status == "To Explore" else "#28a745"  # 🔵 Blue → 🟢 Green

            folium.PolyLine(
                coordinates, 
                color=track_color, 
                weight=5, 
                opacity=0.7,
                popup=f"Track {track_index}: {track_status}",
                tooltip="Click near this track!"
            ).add_to(m)

            # 🔵 Start and End Points
            for point in [coordinates[0], coordinates[-1]]:  
                folium.CircleMarker(
                    location=point,
                    radius=6,
                    color=track_color,
                    fill=True,
                    fill_color=track_color,
                    fill_opacity=0.9
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