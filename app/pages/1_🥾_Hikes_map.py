import pathlib

import folium
import geopy.distance
import gpxpy
import streamlit as st
from streamlit_folium import st_folium

from functions.bootstrap_trails import bootstrap_planned_trails
from functions.env_loader import load_env_if_needed
from functions.gpx import handle_uploaded_gpx
from functions.trail_converter import gpx_track_to_trail, load_trails_from_gpx_data
from functions.trail_models import Trail
from functions.trail_storage import get_all_trails, save_trail, update_trail_status

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

    # Bootstrap planned trails from disk if not in Firestore
    cur_dir = pathlib.Path(__file__).parent.parent.absolute()
    planned_gpx_file = cur_dir / "tracks_gpx/planned_hikes/all-skane-trails.gpx"
    
    # Only bootstrap once per session
    if "planned_trails_bootstrapped" not in st.session_state:
        count, message = bootstrap_planned_trails(planned_gpx_file)
        st.session_state.planned_trails_bootstrapped = True
        if count > 0:
            st.info(f"📍 {message}")
            # Trigger a reload to display the newly loaded trails
            st.rerun()


# Initialize session state for trail source toggle if not already set
if "use_world_wide_hikes" not in st.session_state:
    st.session_state.use_world_wide_hikes = False
    
# 📂 Load trails from Firestore based on current toggle state
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

    # Reload data if trail source has changed
    if "trails" not in st.session_state or st.session_state.get("last_trail_source") != use_world_wide_hikes:
        st.session_state.trails = []  # List of Trail objects from Firestore
        st.session_state.last_trail_source = use_world_wide_hikes
        
        # Load all trails from Firestore
        all_trails = get_all_trails()

        # Load trails from Firestore
        all_trails = get_all_trails()
        
        # Filter trails by source based on toggle
        # Trail sources:
        #   - "skaneleden": Official Skåneleden trails (special coloring/behavior)
        #   - "other_trails": Additional local trails uploaded by admins
        #   - "world_wide_hikes": International trails uploaded by users
        #   - (future) "user_wishlist": Trails users want to hike
        if use_world_wide_hikes:
            st.session_state.trails = [t for t in all_trails if t.source == "world_wide_hikes"]
        else:
            # Show Skåneleden and other local trails
            st.session_state.trails = [t for t in all_trails if t.source in ("planned_hikes", "other_trails")]

# Display statistics and upload button in the left column
with tab1:
    with col1:
        if st.session_state.trails:
            st.header("Track Statistics")

            # Calculate total tracks from Firestore trails (exclude planned hikes - those are available/planned trails)
            user_trails = [t for t in st.session_state.trails if t.source != "planned_hikes"]
            total_tracks = len(user_trails)
            
            # Calculate explored tracks (only user trails)
            explored_tracks = sum(1 for trail in user_trails if trail.status == "Explored!")

            st.metric("Total Tracks", total_tracks)
            st.metric("Explored Tracks", explored_tracks)
            st.metric(
                "Completion Rate", f"{int((explored_tracks / total_tracks) * 100)}%" if total_tracks > 0 else "0%"
            )

            # Add trail legend
            st.subheader("🗺️ Trail Legend")
            
            # Count trails by source
            planned_count = sum(1 for t in st.session_state.trails if t.source == "planned_hikes")
            other_trails_count = sum(1 for t in st.session_state.trails if t.source == "other_trails")
            world_wide_count = sum(1 for t in st.session_state.trails if t.source == "world_wide_hikes")
            
            if planned_count > 0:
                st.markdown(f"**Planned Hikes** ({planned_count}): 🟠 To Explore → 🟢 Explored")
            if other_trails_count > 0:
                st.markdown(f"**Local Trails** ({other_trails_count}): 🔵 Uploaded trails")
            if world_wide_count > 0:
                st.markdown(f"**World Wide** ({world_wide_count}): 🔵 Uploaded trails")

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
                            uploaded_file,
                            is_world_wide=st.session_state.use_world_wide_hikes,
                        )
                    if success:
                        st.success(message)
                        # Mark this file as processed
                        st.session_state.last_uploaded_file_id = uploaded_file_id
                        # Force reload of trails by clearing the cache
                        if "trails" in st.session_state:
                            del st.session_state["trails"]
                        # Force refresh to show new track
                        st.rerun()
                    else:
                        st.error(message)

    # Display Map in the right column if file is loaded or additional tracks exist
    with col2:
        # Check if there are tracks to display from Firestore
        tracks_to_display = st.session_state.trails

        if tracks_to_display:
            # 🗺️ Get all track coordinates to center map
            all_coords = []

            # Collect coordinates from Firestore trails
            for trail in st.session_state.trails:
                all_coords.extend(trail.coordinates_map)

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

            # Plot trails from Firestore
            for trail in st.session_state.trails:
                # Color scheme:
                # - Planned hikes: Orange for to explore, dark green for explored
                # - Uploaded trails: Blue (always blue, shows user-added content)
                if trail.source == "planned_hikes":
                    track_color = "#FF8C00" if trail.status == "To Explore" else "#006400"  # Orange → Dark Green
                    weight = 5
                    opacity = 0.8
                else:
                    # Other trails and world-wide hikes: Blue
                    track_color = "#2683b5"  # Blue
                    weight = 4
                    opacity = 0.7

                # Plot the trail
                # Convert coordinates to list format for Folium
                coords_for_folium = [[lat, lng] for lat, lng in trail.coordinates_map]
                folium.PolyLine(
                    coords_for_folium,
                    color=track_color,
                    weight=weight,
                    opacity=opacity,
                    popup=f"{trail.name}: {trail.status}",
                    tooltip=f"Click to toggle status: {trail.name}",
                ).add_to(m)

                # Start and End Points with matching colors
                if trail.coordinates_map:
                    start_point = trail.coordinates_map[0]
                    end_point = trail.coordinates_map[-1]
                    for point in [start_point, end_point]:
                        folium.CircleMarker(
                            location=[point[0], point[1]],
                            radius=6,
                            color=track_color,
                            fill=True,
                            fill_color=track_color,
                            fill_opacity=0.9,
                        ).add_to(m)

            # Enable ClickForMarker (lets us detect clicks on the map)
            m.add_child(folium.LatLngPopup())

            # Get the screen height (approximated)
            map_height = 800  # Larger default height

            # Display the interactive map with full width and calculated height
            # returned_objects=["last_clicked"] prevents reruns on zoom/pan, only on clicks
            map_data = st_folium(m, height=map_height, width=None, key="map", returned_objects=["last_clicked"])

            # Handle map clicks to toggle trail status
            if map_data and "last_clicked" in map_data and map_data["last_clicked"] is not None:
                clicked_latlng = (map_data["last_clicked"]["lat"], map_data["last_clicked"]["lng"])

                # Find the closest trail to the clicked location
                closest_trail = None
                min_distance = float("inf")

                for trail in st.session_state.trails:
                    for point in trail.coordinates_map:
                        distance = geopy.distance.geodesic(clicked_latlng, point).meters
                        if distance < min_distance:
                            min_distance = distance
                            closest_trail = trail

                # Toggle trail status if within 50 meters
                if closest_trail is not None and min_distance < CLICK_RANGE_METERS:
                    # Toggle between "To Explore" and "Explored!"
                    new_status = "Explored!" if closest_trail.status == "To Explore" else "To Explore"
                    
                    # Update in Firestore
                    try:
                        update_trail_status(closest_trail.trail_id, new_status)
                        
                        # Update local state
                        closest_trail.status = new_status
                        
                        st.success(f"✅ {closest_trail.name} has been marked as '{new_status}' and saved!")
                        
                        # Force UI refresh to update map color
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Failed to update trail status: {e}")
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
