import pathlib
import sys
from pathlib import Path

import folium
import geopy.distance
import streamlit as st
from streamlit_folium import st_folium

# Add project root to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.absolute()))

from app.functions.bootstrap_trails import bootstrap_planned_trails
from app.functions.env_loader import load_env_if_needed
from app.functions.gpx import handle_uploaded_gpx
from app.functions.tracks import filter_trails
from app.functions.trail_storage import delete_trail, get_all_trails, update_trail_name, update_trail_status
from app.resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE

# Load environment variables (with platform precedence)
load_env_if_needed()

# Constants
CLICK_RANGE_METERS = 50  # Distance threshold for track click detection

# Set page config to wide mode for full-width layout
st.set_page_config(layout="wide")

st.title("🥾 Skåne Trails Explorer")

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

# Initialize selected trail for highlighting
if "selected_trail_id" not in st.session_state:
    st.session_state.selected_trail_id = None

# Add toggle for trail source (above filters)
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

# --- Filter Section (Above Map) ---
if st.session_state.trails:
    with st.expander("🔍 Filter Trails", expanded=True):
        # Initialize filter state in session
        if "filter_search" not in st.session_state:
            st.session_state.filter_search = ""
        if "filter_min_distance" not in st.session_state:
            st.session_state.filter_min_distance = DEFAULT_MIN_DISTANCE
        if "filter_max_distance" not in st.session_state:
            st.session_state.filter_max_distance = DEFAULT_MAX_DISTANCE
        if "filter_status" not in st.session_state:
            st.session_state.filter_status = "All"

        # Create horizontal layout for filters
        filter_col1, filter_col2, filter_col3, filter_col4 = st.columns([2, 2, 2, 1])

        with filter_col1:
            search_query = st.text_input(
                "Search by name:",
                value=st.session_state.filter_search,
                placeholder="e.g., Söderåsen",
                key="trail_search_input",
            )
            st.session_state.filter_search = search_query

        with filter_col2:
            distance_range = st.slider(
                "Distance (km):",
                min_value=0.0,
                max_value=100.0,
                value=(st.session_state.filter_min_distance, st.session_state.filter_max_distance),
                step=1.0,
                key="distance_slider",
                help="Note: Distance filter does not apply to Planned Hikes (Skåneleden)",
            )
            st.session_state.filter_min_distance = distance_range[0]
            st.session_state.filter_max_distance = distance_range[1]

        with filter_col3:
            status_filter = st.radio(
                "Show:",
                options=["All", "Explored only", "To explore only"],
                index=0
                if st.session_state.filter_status == "All"
                else (1 if st.session_state.filter_status == "Explored only" else 2),
                horizontal=True,
                key="status_filter_radio",
            )
            st.session_state.filter_status = status_filter

        with filter_col4:
            st.write("")  # Spacer for alignment
            if st.button("Clear Filters", key="clear_filters_btn"):
                st.session_state.filter_search = ""
                st.session_state.filter_min_distance = DEFAULT_MIN_DISTANCE
                st.session_state.filter_max_distance = DEFAULT_MAX_DISTANCE
                st.session_state.filter_status = "All"
                st.rerun()

# Apply filters to trails
show_explored = st.session_state.get("filter_status") == "Explored only"
show_unexplored = st.session_state.get("filter_status") == "To explore only"
filtered_trails = filter_trails(
    st.session_state.trails,
    search_query=st.session_state.get("filter_search", ""),
    min_distance_km=st.session_state.get("filter_min_distance", DEFAULT_MIN_DISTANCE),
    max_distance_km=st.session_state.get("filter_max_distance", DEFAULT_MAX_DISTANCE),
    show_explored_only=show_explored,
    show_unexplored_only=show_unexplored,
)

# Create columns for sidebar and map layout (AFTER filters)
col1, col2 = st.columns([1, 4], gap="large")  # 1:4 ratio gives 20% width to stats, 80% to map

# Display statistics and upload button in the left column
with col1:
    if st.session_state.trails:
        st.header("Track Statistics")

        # Check if filters are active
        has_active_filters = (
            st.session_state.get("filter_search", "")
            or st.session_state.get("filter_min_distance", 0) > DEFAULT_MIN_DISTANCE
            or st.session_state.get("filter_max_distance", DEFAULT_MAX_DISTANCE) < DEFAULT_MAX_DISTANCE
            or st.session_state.get("filter_status", "All") != "All"
        )

        # Show filtered count if filters are active
        if has_active_filters:
            st.metric("Showing", f"{len(filtered_trails)} of {len(st.session_state.trails)}")

        # Calculate total tracks from Firestore trails (exclude planned hikes - those are available/planned trails)
        user_trails = [t for t in st.session_state.trails if t.source != "planned_hikes"]
        total_tracks = len(user_trails)

        # Calculate explored tracks (only user trails)
        explored_tracks = sum(1 for trail in user_trails if trail.status == "Explored!")

        st.metric("Total Tracks", total_tracks)
        st.metric("Explored Tracks", explored_tracks)
        st.metric("Completion Rate", f"{int((explored_tracks / total_tracks) * 100)}%" if total_tracks > 0 else "0%")

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

    # Show selected trail details and rename option
    if st.session_state.selected_trail_id:
        selected_trail = next(
            (t for t in st.session_state.trails if t.trail_id == st.session_state.selected_trail_id), None
        )
        if selected_trail:
            st.divider()
            st.subheader("📍 Selected Trail")

            # Display trail info
            st.write(f"**{selected_trail.name}**")
            st.write(f"Distance: {selected_trail.length_km:.1f} km")

            if selected_trail.activity_date:
                date_str = selected_trail.activity_date.split("T")[0]
                st.write(f"Date: {date_str}")

            if selected_trail.activity_type:
                st.write(f"Activity: {selected_trail.activity_type.title()}")

            if selected_trail.elevation_gain is not None:
                st.write(f"Elevation Gain: {selected_trail.elevation_gain:.0f} m")

            # Rename section
            with st.form(key="rename_trail_form"):
                new_name = st.text_input("Rename trail:", value=selected_trail.name, max_chars=100)
                col_rename, col_clear = st.columns(2)

                with col_rename:
                    rename_submitted = st.form_submit_button("Rename", use_container_width=True)

                with col_clear:
                    clear_selection = st.form_submit_button("Clear", use_container_width=True)

                if rename_submitted and new_name and new_name != selected_trail.name:
                    try:
                        update_trail_name(selected_trail.trail_id, new_name)
                        selected_trail.name = new_name
                        st.success(f"✅ Renamed to: {new_name}")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Failed to rename: {e}")

                if clear_selection:
                    st.session_state.selected_trail_id = None
                    st.rerun()

            # Delete section with confirmation
            with st.expander("🗑️ Delete Trail", expanded=False):
                st.warning(f"⚠️ This will permanently delete **{selected_trail.name}**")

                with st.form(key="delete_trail_form"):
                    confirm_delete = st.checkbox("I confirm I want to delete this trail")
                    delete_submitted = st.form_submit_button(
                        "Delete Permanently", type="primary", use_container_width=True
                    )

                    if delete_submitted:
                        if confirm_delete:
                            try:
                                delete_trail(selected_trail.trail_id)
                                # Remove from session state trails list
                                st.session_state.trails = [
                                    t for t in st.session_state.trails if t.trail_id != selected_trail.trail_id
                                ]
                                st.session_state.selected_trail_id = None
                                st.success(f"✅ Deleted: {selected_trail.name}")
                                st.rerun()
                            except Exception as e:
                                st.error(f"❌ Failed to delete: {e}")
                        else:
                            st.error("Please check the confirmation box to delete")

    # Add GPX upload section - always visible, not just when trails exist
    st.subheader("Upload Additional Trails")
    uploaded_file = st.file_uploader("Upload GPX file", type=["gpx"], key="gpx_uploader")

    # Handle file upload - check if we haven't already processed this file
    if uploaded_file is not None:
        # Use a session state flag to track if we've processed this upload
        uploaded_file_id = f"{uploaded_file.name}_{uploaded_file.size}"
        if st.session_state.get("last_uploaded_file_id") != uploaded_file_id:
            with st.spinner(f"Validating and uploading {uploaded_file.name}..."):
                success, message = handle_uploaded_gpx(
                    uploaded_file, is_world_wide=st.session_state.use_world_wide_hikes
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

# Display Map in the right column
with col2:
    # 🗺️ Get all track coordinates to center map
    all_coords = []

    # Collect coordinates from filtered trails
    if filtered_trails:
        for trail in filtered_trails:
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
    # If no coordinates, use defaults based on mode
    elif st.session_state.use_world_wide_hikes:
        m = folium.Map(location=[43.7696, 11.2558], zoom_start=7)  # Centered on Florence
    else:
        # Default to Skåne region when no trails exist
        m = folium.Map(location=[56.0, 13.5], zoom_start=9)  # Centered on Skåne

    # Plot filtered trails (if any exist after filtering)
    if filtered_trails:
        # Plot planned hikes first (will be underneath), then uploaded trails (on top)
        planned_trails = [t for t in filtered_trails if t.source == "planned_hikes"]
        uploaded_trails = [t for t in filtered_trails if t.source != "planned_hikes"]

        for trail in planned_trails + uploaded_trails:
            # Check if this trail is selected for highlighting
            is_selected = st.session_state.selected_trail_id == trail.trail_id

            # Color scheme:
            # - Planned hikes: Orange for to explore, dark green for explored
            # - Uploaded trails: Blue (always blue, shows user-added content)
            # - Selected trails: Brighter with thicker line
            if trail.source == "planned_hikes":
                track_color = "#FF8C00" if trail.status == "To Explore" else "#006400"  # Orange → Dark Green
                weight = 7 if is_selected else 5
                opacity = 1.0 if is_selected else 0.8
            else:
                # Other trails and world-wide hikes: Blue
                track_color = "#2683b5"  # Blue
                weight = 6 if is_selected else 4
                opacity = 0.95 if is_selected else 0.7

            # Build popup HTML with trail information
            popup_html = f"<b>{trail.name}</b><br>"
            popup_html += f"Distance: {trail.length_km:.1f} km<br>"

            if trail.activity_date:
                # Format date nicely (remove time if present)
                date_str = trail.activity_date.split("T")[0]
                popup_html += f"Date: {date_str}<br>"

            if trail.activity_type:
                popup_html += f"Activity: {trail.activity_type.title()}<br>"

            if trail.elevation_gain is not None:
                popup_html += f"Elevation Gain: {trail.elevation_gain:.0f} m<br>"

            if trail.elevation_loss is not None:
                popup_html += f"Elevation Loss: {trail.elevation_loss:.0f} m<br>"

            # Add status for planned hikes
            if trail.source == "planned_hikes":
                popup_html += f"<br><i>Status: {trail.status}</i>"

            # Different tooltip for planned vs uploaded hikes
            if trail.source == "planned_hikes":
                tooltip_text = f"Click to toggle status: {trail.name}"
            else:
                tooltip_text = f"Click for details: {trail.name}"

            # Plot the trail
            # Convert coordinates to list format for Folium
            coords_for_folium = [[lat, lng] for lat, lng in trail.coordinates_map]
            folium.PolyLine(
                coords_for_folium,
                color=track_color,
                weight=weight,
                opacity=opacity,
                popup=folium.Popup(popup_html, max_width=300),
                tooltip=tooltip_text,
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

    # Enable ClickForMarker (lets us detect clicks on the map) - always add regardless of trails
    m.add_child(folium.LatLngPopup())

    # Get the screen height (approximated)
    map_height = 800  # Larger default height

    # Display the interactive map with full width and calculated height
    # returned_objects=["last_clicked"] prevents reruns on zoom/pan, only on clicks
    map_data = st_folium(m, height=map_height, width=None, key="map", returned_objects=["last_clicked"])

    # Handle map clicks (only if trails exist)
    MAX_CLICK_DISTANCE_METERS = 1000  # Maximum distance to consider a click on a trail
    if st.session_state.trails and map_data and "last_clicked" in map_data and map_data["last_clicked"] is not None:
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

        # If we found a trail within reasonable distance, process the click
        if closest_trail and min_distance < MAX_CLICK_DISTANCE_METERS:
            # Highlight the clicked trail
            st.session_state.selected_trail_id = closest_trail.trail_id

            # Only toggle status for planned hikes - uploaded hikes are already done
            if closest_trail.source == "planned_hikes":
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
                # For uploaded hikes, just highlight and show in sidebar
                st.rerun()

    # Show info message when no trails exist
    if not st.session_state.trails:
        st.info("📍 No trails yet. Upload a GPX file to get started!")
