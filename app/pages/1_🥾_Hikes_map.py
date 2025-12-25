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
from app.functions.place_models import Place, get_category_display
from app.functions.places_storage import get_all_places
from app.functions.tracks import filter_trails
from app.functions.trail_storage import get_all_trails, update_trail_status
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


# --- Load Places (POIs) ---
@st.cache_data(ttl=300)  # Cache for 5 minutes
def load_places() -> list[Place]:
    """Load all places from Firestore."""
    return get_all_places()


# Initialize places in session state
if "places" not in st.session_state:
    st.session_state.places = load_places()

# Build available place categories from data
available_place_categories: dict[str, str] = {}
for place in st.session_state.places:
    for cat in place.categories:
        if cat.slug not in available_place_categories:
            display = get_category_display(cat.slug)
            available_place_categories[cat.slug] = f"{display['icon']} {display['name']}"

# Initialize place category filter
if "selected_place_categories" not in st.session_state:
    st.session_state.selected_place_categories = []

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
                st.session_state.selected_place_categories = []
                st.rerun()

# --- Places (POI) Filter Section ---
if st.session_state.places and available_place_categories:
    with st.expander("📍 Show Points of Interest", expanded=False):
        st.markdown("Select POI categories to display on the map:")

        # Create checkboxes for each category in a grid layout
        poi_cols = st.columns(4)
        selected_slugs = []

        for idx, (slug, display_name) in enumerate(sorted(available_place_categories.items())):
            col_idx = idx % 4
            with poi_cols[col_idx]:
                # Check if this category was previously selected
                is_selected = slug in st.session_state.get("selected_place_categories", [])
                if st.checkbox(display_name, value=is_selected, key=f"poi_{slug}"):
                    selected_slugs.append(slug)

        st.session_state.selected_place_categories = selected_slugs

        # Show count of selected places
        if selected_slugs:
            filtered_places = [
                p for p in st.session_state.places if any(slug in p.category_slugs for slug in selected_slugs)
            ]
            st.caption(f"Showing {len(filtered_places)} places")

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

    # --- Plot POI Markers ---
    selected_poi_categories = st.session_state.get("selected_place_categories", [])
    if selected_poi_categories and st.session_state.places:
        # Color mapping for POI categories
        POI_COLORS = {
            "parkering": "blue",
            "vatten": "lightblue",
            "lagerplats-med-vindskydd": "green",
            "toalett": "purple",
            "kollektivtrafik": "orange",
            "boende": "red",
            "badplats": "cadetblue",
            "ata-dricka": "pink",
            "livsmedelgardsbutik": "lightgreen",
            "sevardhet": "darkred",
            "aktivitet": "darkgreen",
            "turistinformation": "gray",
            "konst": "darkpurple",
            "naturlekplats": "lightgreen",
        }

        for place in st.session_state.places:
            # Check if place matches any selected category
            if any(slug in selected_poi_categories for slug in place.category_slugs):
                # Get primary category for color
                primary_slug = place.category_slugs[0] if place.category_slugs else "unknown"
                color = POI_COLORS.get(primary_slug, "gray")

                # Build popup content
                categories_str = ", ".join(place.category_names)
                popup_html = f"""
                <b>{place.name}</b><br>
                <i>{categories_str}</i><br>
                {f"📍 {place.city}" if place.city else ""}
                {f"<br><a href='{place.weburl}' target='_blank'>More info</a>" if place.weburl else ""}
                """

                folium.Marker(
                    location=[place.lat, place.lng],
                    popup=folium.Popup(popup_html, max_width=300),
                    tooltip=place.name,
                    icon=folium.Icon(color=color, icon="info-sign"),
                ).add_to(m)

    # Enable ClickForMarker (lets us detect clicks on the map) - always add regardless of trails
    m.add_child(folium.LatLngPopup())

    # Get the screen height (approximated)
    map_height = 800  # Larger default height

    # Display the interactive map with full width and calculated height
    # returned_objects=["last_clicked"] prevents reruns on zoom/pan, only on clicks
    map_data = st_folium(m, height=map_height, width=None, key="map", returned_objects=["last_clicked"])

    # Handle map clicks to toggle trail status (only if trails exist)
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

    # Show info message when no trails exist
    if not st.session_state.trails:
        st.info("📍 No trails yet. Upload a GPX file to get started!")
