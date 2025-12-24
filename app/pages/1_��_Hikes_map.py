import pathlib

import folium
import geopy.distance
import gpxpy
import streamlit as st
from streamlit_folium import st_folium

from app.functions.env_loader import load_env_if_needed
from app.functions.gpx import handle_uploaded_gpx, load_additional_gpx_files
from app.functions.tracks import load_track_statuses, save_track_statuses

# Load environment variables (with platform precedence)
load_env_if_needed()

# Constants
CLICK_RANGE_METERS = 50  # Distance threshold for track click detection
TITLE_DESCRIPTION_PARTS = 2  # Expected parts when splitting improvement text

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
    unsafe_allow_html=True,
)


st.title("🥾 Skåne Trails Explorer & Future Improvements")

# Create tabs
tab1, tab2 = st.tabs(["Map and trails 🌍", "🚀 Possible Improvements"])


# Main GPX Explorer Tab
with tab1:
    # Use columns to create a sidebar-like layout while maintaining full width for the map
    col1, col2 = st.columns([1, 4], gap="large")  # 1:4 ratio gives 20% width to stats, 80% to map

    with col1:
        # 🎨 Streamlit App Title (in the sidebar)
        st.title("Skåne map and trails 🌍")

    # Define file paths (use relative paths for better portability)
    cur_dir = pathlib.Path(__file__).parent.parent.absolute()
    data_directory = cur_dir
    # Create data directory if it doesn't exist
    data_directory.mkdir(parents=True, exist_ok=True)

    # Define the path to the GPX file and CSV file
    world_wide_hikes_path = data_directory / "tracks_gpx/world_wide_hikes/"
    skaneleden_gpx_file_path = data_directory / "tracks_gpx/skaneleden/all-skane-trails.gpx"  # Main GPX file
    skane_other_files_path = data_directory / "tracks_gpx/other_trails/"  # Directory with other trails
    skaneleden_status = data_directory / "tracks_status/track_skaneleden_status.csv"  # Path for saving track statuses
    # Create directories if they don't exist

    skaneleden_status.parent.mkdir(parents=True, exist_ok=True)
    skane_other_files_path.mkdir(parents=True, exist_ok=True)
    world_wide_hikes_path.mkdir(parents=True, exist_ok=True)


# Initialize session state for trail source toggle if not already set
if "use_world_wide_hikes" not in st.session_state:
    st.session_state.use_world_wide_hikes = False
# 📂 Load GPX file based on current toggle state
with tab1:
    with col1:
        # Add toggle for trail source
        use_world_wide_hikes = st.toggle(
            "Use World Wide Hikes",
            value=st.session_state.get("use_world_wide_hikes", False),
            help="Toggle between Skåne trails and World Wide hikes",
        )

        # Update session state with the toggle value
        st.session_state.use_world_wide_hikes = use_world_wide_hikes

    # Determine which GPX files to load based on toggle
    if use_world_wide_hikes:
        gpx_file_path = None  # No main GPX file for world-wide hikes
        additional_files_path = world_wide_hikes_path
    else:
        gpx_file_path = skaneleden_gpx_file_path
        additional_files_path = skane_other_files_path

    # Reload data if trail source has changed
    if "gpx_data" not in st.session_state or st.session_state.get("last_trail_source") != use_world_wide_hikes:
        st.session_state.gpx_data = None
        st.session_state.file_loaded = False
        st.session_state.track_status = {}
        st.session_state.additional_tracks = []
        st.session_state.last_trail_source = use_world_wide_hikes

        # Load main GPX file if it exists (not applicable for world-wide hikes)
        if gpx_file_path and gpx_file_path.exists() and not use_world_wide_hikes:
            with gpx_file_path.open(encoding="utf-8") as gpx_file:
                gpx_string = gpx_file.read()  # Read file as string
                st.session_state.gpx_data = gpxpy.parse(gpx_string)
                st.session_state.file_loaded = True

                # Load track statuses from CSV or initialize new
                st.session_state.track_status = load_track_statuses(skaneleden_status)

                # Assign "To Explore" to all tracks if not already set
                for i in range(len(st.session_state.gpx_data.tracks)):
                    if i not in st.session_state.track_status:
                        st.session_state.track_status[i] = "To Explore"

                # Save initial statuses if needed
                save_track_statuses(st.session_state.track_status, skaneleden_status)

            # Load additional tracks based on current toggle state
            st.session_state.additional_tracks = load_additional_gpx_files(additional_files_path)
        elif use_world_wide_hikes:
            # Load track statuses from CSV or initialize new
            st.session_state.track_status = load_track_statuses(skaneleden_status)
            # Load additional tracks for world-wide hikes
            st.session_state.additional_tracks = load_additional_gpx_files(additional_files_path)
        else:
            st.session_state.file_loaded = False
            st.error(f"File not found: {gpx_file_path}")
            st.session_state.additional_tracks = []

# Display statistics and upload button in the left column
with tab1:
    with col1:
        if st.session_state.get("file_loaded", False) or st.session_state.additional_tracks:
            st.header("Track Statistics")

            # Calculate total tracks
            total_tracks = 0
            gpx_data = st.session_state.get("gpx_data")
            if gpx_data:
                total_tracks += len(gpx_data.tracks)
            total_tracks += len(st.session_state.additional_tracks)

            # Calculate explored tracks
            explored_tracks = 0
            if st.session_state.get("track_status"):
                explored_tracks = sum(1 for status in st.session_state.track_status.values() if status == "Explored!")

            st.metric("Total Tracks", total_tracks)
            st.metric("Explored Tracks", explored_tracks)
            st.metric(
                "Completion Rate", f"{int((explored_tracks / total_tracks) * 100)}%" if total_tracks > 0 else "0%"
            )

            # Display a button to manually save status
            if st.button("Save Track Status") and save_track_statuses(st.session_state.track_status, skaneleden_status):
                st.success("Track statuses saved successfully!")

            # Add GPX upload section
            st.subheader("Upload Additional Trails")
            uploaded_file = st.file_uploader("Upload GPX file", type=["gpx"], key="gpx_uploader")

            # Handle file upload - check if we haven't already processed this file
            if uploaded_file is not None:
                # Use a session state flag to track if we've processed this upload
                uploaded_file_id = f"{uploaded_file.name}_{uploaded_file.size}"
                if st.session_state.get("last_uploaded_file_id") != uploaded_file_id:
                    with st.spinner(f"Validating and uploading {uploaded_file.name}..."):
                        success, message = handle_uploaded_gpx(
                            world_wide_hikes_path,
                            skane_other_files_path,
                            uploaded_file,
                            is_world_wide=st.session_state.use_world_wide_hikes,
                        )
                    if success:
                        st.success(message)
                        # Mark this file as processed
                        st.session_state.last_uploaded_file_id = uploaded_file_id
                        # Force reload of additional tracks by clearing the cache
                        if "gpx_data" in st.session_state:
                            del st.session_state["gpx_data"]
                        # Force refresh to show new track
                        st.rerun()
                    else:
                        st.error(message)

    # Display Map in the right column if file is loaded or additional tracks exist
    with col2:
        # Check if there are tracks to display (main tracks or additional tracks)
        gpx_data = st.session_state.get("gpx_data")
        tracks_to_display = (gpx_data and len(gpx_data.tracks) > 0) or len(st.session_state.additional_tracks) > 0

        if tracks_to_display:
            # 🗺️ Get all track coordinates to center map
            all_coords = []
            track_segments = {}  # Store track segments separately {track_index: [segment1, segment2, ...]}

            # Process main GPX tracks if they exist
            gpx_data = st.session_state.get("gpx_data")
            if gpx_data:
                track_index = 0  # Ensuring unique track index
                for track in gpx_data.tracks:
                    # Collect all segments for this track as separate lists
                    segments = []
                    for segment in track.segments:
                        coordinates = [(point.latitude, point.longitude) for point in segment.points]
                        if coordinates:
                            segments.append(coordinates)
                            all_coords.extend(coordinates)

                    # Store all segments of this track under one track_index
                    if segments:
                        track_segments[track_index] = segments
                        track_index += 1

            # Add coordinates from additional tracks for map centering
            for track in st.session_state.additional_tracks:
                for segment in track["segments"]:
                    all_coords.extend(segment)

            # Store track segments in session state for the stats panel
            st.session_state.track_segments = track_segments

            # Compute map center & zoom
            if all_coords:
                avg_lat = sum(lat for lat, lon in all_coords) / len(all_coords)
                avg_lon = sum(lon for lat, lon in all_coords) / len(all_coords)

                # Check if using world-wide hikes and set specific center for Italy
                if st.session_state.use_world_wide_hikes:
                    # Coordinates for central Italy (e.g., Tuscany region)
                    m = folium.Map(location=[43.7696, 11.2558], zoom_start=7)  # Centered on Florence
                else:
                    # Original dynamic centering for Skåne trails
                    m = folium.Map(location=[avg_lat, avg_lon], zoom_start=10)
            # If no coordinates, use Italy center as default
            elif st.session_state.use_world_wide_hikes:
                m = folium.Map(location=[43.7696, 11.2558], zoom_start=7)  # Centered on Florence
            else:
                m = folium.Map(zoom_start=10)

            # Plot main tracks with color scheme
            if st.session_state.get("gpx_data"):
                for track_index, segments in track_segments.items():
                    track_status = st.session_state.track_status.get(track_index, "To Explore")
                    # Orange for to explore, dark green for explored
                    track_color = "#FF8C00" if track_status == "To Explore" else "#006400"  # Orange → Dark Green

                    # Plot each segment separately to avoid connecting disconnected segments
                    for segment in segments:
                        folium.PolyLine(
                            segment,
                            color=track_color,
                            weight=5,
                            opacity=0.7,
                            popup=f"Track {track_index}: {track_status}",
                            tooltip="Click near this track!",
                        ).add_to(m)

                    # Start and End Points with matching colors (use first and last segments)
                    if segments:
                        first_segment = segments[0]
                        last_segment = segments[-1]
                        for point in [first_segment[0], last_segment[-1]]:
                            folium.CircleMarker(
                                location=point,
                                radius=6,
                                color=track_color,
                                fill=True,
                                fill_color=track_color,
                                fill_opacity=0.9,
                            ).add_to(m)

            # Plot additional tracks
            for _i, track in enumerate(st.session_state.additional_tracks):
                for segment in track["segments"]:
                    # Create a dashed line for additional tracks
                    folium.PolyLine(
                        segment,
                        color="#2683b5",  # Blue color
                        weight=4,
                        opacity=0.8,
                        popup=f"Additional Trail: {track['name']}",
                        tooltip=f"Trail: {track['name']}",
                    ).add_to(m)

                    # Add circle markers for start and end
                    for point in [segment[0], segment[-1]]:
                        folium.CircleMarker(
                            location=point,
                            radius=5,
                            color="#2683b5",
                            fill=True,
                            fill_color="#2683b5",
                            fill_opacity=0.8,
                            popup=f"Additional Trail: {track['name']}",
                        ).add_to(m)

            # Enable ClickForMarker (lets us detect clicks on the map)
            m.add_child(folium.LatLngPopup())

            # Get the screen height (approximated)
            map_height = 800  # Larger default height

            # Display the interactive map with full width and calculated height
            # returned_objects=["last_clicked"] prevents reruns on zoom/pan, only on clicks
            map_data = st_folium(m, height=map_height, width=None, key="map", returned_objects=["last_clicked"])

            # Existing click handling code remains the same
            if map_data and "last_clicked" in map_data and map_data["last_clicked"] is not None:
                clicked_latlng = (map_data["last_clicked"]["lat"], map_data["last_clicked"]["lng"])

                # Find the closest track segment to the clicked location
                closest_track = None
                min_distance = float("inf")

                for track_idx, segments in track_segments.items():
                    for segment in segments:
                        for point in segment:
                            distance = geopy.distance.geodesic(clicked_latlng, point).meters
                            if distance < min_distance:
                                min_distance = distance
                                closest_track = track_idx

                # Toggle track status if within 50 meters
                if closest_track is not None and min_distance < CLICK_RANGE_METERS:
                    current_status = st.session_state.track_status.get(closest_track, "To Explore")

                    # ✅ Toggle between "To Explore" and "Explored!"
                    new_status = "Explored!" if current_status == "To Explore" else "To Explore"
                    st.session_state.track_status[closest_track] = new_status

                    # Save the updated status to CSV
                    save_success = save_track_statuses(st.session_state.track_status, skaneleden_status)

                    # 🔥 Pop-up message
                    if save_success:
                        st.success(f"✅ Track {closest_track} has been marked as '{new_status}' and saved!")
                    else:
                        st.success(f"✅ Track {closest_track} has been marked as '{new_status}' but couldn't be saved.")

                    # 🚀 Force UI refresh to update map color
                    st.rerun()
        else:
            st.warning("No tracks available to display. Try uploading a GPX file.")

# Possible Improvements Tab
with tab2:
    st.title("🚀 Possible Improvements")
    improvements = [
        "Add bubbles to Skåneleden to split the track"
        "Calculate trails distance-"
        "Trail Filtering & Search: Filter/search trails by difficulty, length, location.",
        "Elevation Profile: Show elevation charts for climbs and descents.",
        "Trail Details Panel: Display distance, estimated time, difficulty, highest point.",
        "Trail Photos: Upload and view photos from specific trail points.",
        "Trail Combining: Combine multiple segments into a custom route.",
        "Trail Ratings/Reviews: Allow users to rate and review trails.",
        "Nearby Points of Interest: Show parking areas, fireplaces, shelters, restrooms, water sources, viewpoints.",
        "Trail Condition Reports: Report/view trail conditions (muddy, fallen trees, etc.).",
        "Trail Statistics Dashboard: Visual stats of user's hiking history (distance, elevation gain, etc.).",
    ]
    for improvement in improvements:
        parts = improvement.split(":", 1)  # Split into two parts at the first colon
        if len(parts) == TITLE_DESCRIPTION_PARTS:
            title, description = parts
            st.markdown(f"<p style='font-size:18px;'><b>{title}:</b>{description}</p>", unsafe_allow_html=True)
        else:
            st.markdown(f"<p style='font-size:18px;'><b>{improvement}</b></p>", unsafe_allow_html=True)
