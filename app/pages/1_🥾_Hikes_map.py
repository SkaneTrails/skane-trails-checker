import logging
import pathlib
import sys
from pathlib import Path

import folium
import geopy.distance
import streamlit as st
from streamlit_folium import st_folium

# Get logger (configured in _Home_.py)
logger = logging.getLogger(__name__)

# Add project root to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.absolute()))

from app.functions.bootstrap_trails import bootstrap_planned_trails  # noqa: E402
from app.functions.env_loader import load_env_if_needed  # noqa: E402
from app.functions.gpx import handle_uploaded_gpx  # noqa: E402
from app.functions.place_models import Place, get_category_display  # noqa: E402
from app.functions.places_storage import get_all_places  # noqa: E402
from app.functions.tracks import filter_trails  # noqa: E402
from app.functions.trail_storage import (  # noqa: E402
    delete_trail,
    get_all_trails,
    update_trail_name,
    update_trail_status,
)
from app.resources.hikes_resources import DEFAULT_MAX_DISTANCE, DEFAULT_MIN_DISTANCE  # noqa: E402

# Load environment variables (with platform precedence)
load_env_if_needed()

# Set page config to wide mode for full-width layout
st.set_page_config(layout="wide")

st.title("🥾 Skåne Trails Explorer")


# Cache trail loading to avoid repeated Firestore calls
@st.cache_data(ttl=1800, show_spinner=False)  # Cache for 30 minutes (invalidated manually on mutations)
def load_all_trails() -> list:
    """Load all trails from Firestore with caching."""
    return get_all_trails()


# Bootstrap planned trails from disk if not in Firestore
cur_dir = pathlib.Path(__file__).parent.parent.absolute()
planned_gpx_file = cur_dir / "tracks_gpx/planned_hikes/all-skane-trails.gpx"

# Only bootstrap once per session
if "planned_trails_bootstrapped" not in st.session_state:
    count, message = bootstrap_planned_trails(planned_gpx_file)
    st.session_state.planned_trails_bootstrapped = True
    if count > 0:
        st.info(f"📍 {message}")

# Initialize session state for trail source toggle if not already set
if "use_world_wide_hikes" not in st.session_state:
    st.session_state.use_world_wide_hikes = False

# Initialize selected trail
if "selected_trail_id" not in st.session_state:
    st.session_state.selected_trail_id = None


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

    # Reset map position/zoom when switching trail sources
    if "map_center" in st.session_state:
        del st.session_state.map_center
    if "map_zoom" in st.session_state:
        del st.session_state.map_zoom

    # Reset filter max distance when switching (will be recalculated)
    if "filter_max_distance" in st.session_state:
        del st.session_state.filter_max_distance

    # Load all trails from Firestore (cached)
    all_trails = load_all_trails()

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
        # Calculate dynamic max distance from loaded trails (rounded up to nearest 5km)
        # Only consider user-uploaded trails since distance filter doesn't apply to planned hikes
        if st.session_state.trails:
            filterable_trails = [t for t in st.session_state.trails if t.source != "planned_hikes"]
            if filterable_trails:
                max_trail_length = max(t.length_km for t in filterable_trails)
                dynamic_max_distance = ((int(max_trail_length) // 5) + 1) * 5  # Round up to nearest 5
            else:
                # No user trails, use default
                dynamic_max_distance = DEFAULT_MAX_DISTANCE
        else:
            dynamic_max_distance = DEFAULT_MAX_DISTANCE

        # Initialize filter state in session
        if "filter_search" not in st.session_state:
            st.session_state.filter_search = ""
        if "filter_min_distance" not in st.session_state:
            st.session_state.filter_min_distance = DEFAULT_MIN_DISTANCE
        if "filter_max_distance" not in st.session_state:
            st.session_state.filter_max_distance = dynamic_max_distance

        # Cap filter_max_distance at dynamic_max_distance (in case trails changed or old session state)
        st.session_state.filter_max_distance = min(st.session_state.filter_max_distance, dynamic_max_distance)
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
                max_value=float(dynamic_max_distance),
                value=(float(st.session_state.filter_min_distance), float(st.session_state.filter_max_distance)),
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
                # Invalidate cache and session state to reload trails
                load_all_trails.clear()
                if "trails" in st.session_state:
                    del st.session_state["trails"]
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

    # Compute map center & zoom (use stored values if available, otherwise calculate defaults)
    if all_coords:
        avg_lat = sum(lat for lat, lon in all_coords) / len(all_coords)
        avg_lon = sum(lon for lat, lon in all_coords) / len(all_coords)

        # Initialize map position/zoom in session state on first render to prevent map recreation
        if "map_center" not in st.session_state or "map_zoom" not in st.session_state:
            # Center map based on trail mode (initial defaults)
            if st.session_state.use_world_wide_hikes:
                # Coordinates for central Italy (e.g., Tuscany region)
                st.session_state.map_center = [43.7696, 11.2558]
                st.session_state.map_zoom = 7
            else:
                # Dynamic centering for Skåne trails
                st.session_state.map_center = [avg_lat, avg_lon]
                st.session_state.map_zoom = 10

        # Always use session state values for consistency
        map_center = st.session_state.map_center
        map_zoom = st.session_state.map_zoom
        logger.debug("Using map parameters: center=%s, zoom=%s", map_center, map_zoom)

        m = folium.Map(location=map_center, zoom_start=map_zoom)
        logger.debug("Created new folium.Map object: id=%s, center=%s, zoom=%s", id(m), map_center, map_zoom)
    # If no coordinates, use defaults based on mode
    elif st.session_state.use_world_wide_hikes:
        m = folium.Map(location=[43.7696, 11.2558], zoom_start=7)  # Centered on Florence
        logger.debug("Created new folium.Map object: id=%s (world-wide default)", id(m))
    else:
        # Default to Skåne region when no trails exist
        m = folium.Map(location=[56.0, 13.5], zoom_start=9)  # Centered on Skåne
        logger.debug("Created new folium.Map object: id=%s (Skåne default)", id(m))

    # Plot filtered trails (if any exist after filtering)
    if filtered_trails:
        # Plot planned hikes first (will be underneath), then uploaded trails (on top)
        planned_trails = [t for t in filtered_trails if t.source == "planned_hikes"]
        uploaded_trails = [t for t in filtered_trails if t.source != "planned_hikes"]

        for trail in planned_trails + uploaded_trails:
            # Check if this trail is selected (sidebar open)
            is_selected = trail.trail_id == st.session_state.get("selected_trail_id")

            # Color scheme:
            # - Planned hikes: Orange for to explore, dark green for explored
            # - Uploaded trails: Blue (always blue, shows user-added content)
            # - Selected trail: Bright yellow highlight with thicker line
            if is_selected:
                track_color = "#FFD700"  # Bright gold for selected trail
                weight = 8
                opacity = 1.0
            elif trail.source == "planned_hikes":
                track_color = "#FF8C00" if trail.status == "To Explore" else "#006400"  # Orange → Dark Green
                weight = 5
                opacity = 0.8
            else:
                # Other trails and world-wide hikes: Blue
                track_color = "#2683b5"  # Blue
                weight = 4
                opacity = 0.7

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

            # Plot the trail with popup (first click shows popup, second click opens sidebar)
            coords_for_folium = [[lat, lng] for lat, lng in trail.coordinates_map]
            folium.PolyLine(
                coords_for_folium,
                color=track_color,
                weight=weight,
                opacity=opacity,
                popup=folium.Popup(popup_html, max_width=300),
                tooltip=f"{trail.name} ({trail.length_km:.1f} km)",
            ).add_to(m)

            # Start and End Points with matching colors (visual only, not interactive)
            if trail.coordinates_map:
                start_point = trail.coordinates_map[0]
                end_point = trail.coordinates_map[-1]
                for _point_label, point in [("Start", start_point), ("End", end_point)]:
                    folium.CircleMarker(
                        location=[point[0], point[1]],
                        radius=6,
                        color=track_color,
                        fill=True,
                        fill_color=track_color,
                        fill_opacity=0.9,
                        # No popup or tooltip - visual markers only
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
    # Return last_object_clicked to capture clicks on trails (PolyLines and markers)
    map_data = st_folium(m, height=map_height, width=None, key="map", returned_objects=["last_object_clicked"])

    # Update map position/zoom in session state ONLY if user actually moved the map
    # Don't overwrite on first render to prevent map recreation
    if map_data and "center" in map_data and "zoom" in map_data:
        new_center = [map_data["center"]["lat"], map_data["center"]["lng"]]
        new_zoom = map_data["zoom"]

        logger.debug("map_data returned: center=%s, zoom=%s", new_center, new_zoom)

        # Calculate if the map was actually moved by the user (not just initialized)
        current_center = st.session_state.get("map_center")
        current_zoom = st.session_state.get("map_zoom")

        logger.debug("Current session state: center=%s, zoom=%s", current_center, current_zoom)

        if current_center and current_zoom:
            # Only update if significantly different (user moved the map)
            # Threshold for detecting center movement (degrees)
            CENTER_MOVE_THRESHOLD = 0.001
            center_moved = (
                abs(new_center[0] - current_center[0]) > CENTER_MOVE_THRESHOLD
                or abs(new_center[1] - current_center[1]) > CENTER_MOVE_THRESHOLD
            )
            zoom_changed = new_zoom != current_zoom

            if center_moved or zoom_changed:
                logger.debug("Map moved by user: center=%s, zoom=%s", new_center, new_zoom)
                st.session_state.map_center = new_center
                st.session_state.map_zoom = new_zoom
            else:
                logger.debug("Map position unchanged, not updating session state")

    # Debug: Check what map_data contains
    logger.debug("map_data keys: %s", list(map_data.keys()) if map_data else "None")
    logger.debug("last_object_clicked value: %s", map_data.get("last_object_clicked") if map_data else "None")

    # Handle trail clicks (only if trails exist)
    # Two-click pattern: First click shows popup, second click on same trail opens sidebar
    MAX_CLICK_DISTANCE_METERS = 150  # Increased for more forgiving clicks
    if (
        st.session_state.trails
        and map_data
        and "last_object_clicked" in map_data
        and map_data["last_object_clicked"] is not None
    ):
        clicked_latlng = (map_data["last_object_clicked"]["lat"], map_data["last_object_clicked"]["lng"])
        logger.debug("Object click detected at %s", clicked_latlng)

        # Find which trail was clicked by matching coordinates
        # Use ALL coordinates (not sampled) for accurate click detection
        closest_trail = None
        min_distance = float("inf")

        for trail in st.session_state.trails:
            # Check all coordinates for accurate click detection
            for point in trail.coordinates_map:
                distance = geopy.distance.geodesic(clicked_latlng, point).meters
                if distance < min_distance:
                    min_distance = distance
                    closest_trail = trail

        logger.debug(
            "Closest trail: %s, Distance: %.1fm", closest_trail.name if closest_trail else "None", min_distance
        )

        # Two-click pattern implementation
        if closest_trail and min_distance < MAX_CLICK_DISTANCE_METERS:
            # Check if this is the second click on the same trail
            if st.session_state.get("first_clicked_trail_id") == closest_trail.trail_id:
                # Second click on same trail - open sidebar
                logger.info(
                    "Second click on trail: %s (id: %s) - opening sidebar", closest_trail.name, closest_trail.trail_id
                )
                st.session_state.selected_trail_id = closest_trail.trail_id
            else:
                # First click on this trail - just mark it (popup will show)
                logger.info(
                    "First click on trail: %s (id: %s) - popup will show", closest_trail.name, closest_trail.trail_id
                )
                st.session_state.first_clicked_trail_id = closest_trail.trail_id
                # Clear sidebar selection if switching trails
                if st.session_state.get("selected_trail_id") != closest_trail.trail_id:
                    st.session_state.selected_trail_id = None
        else:
            # Click on empty space - deselect everything
            logger.debug("Click on empty space - deselecting")
            st.session_state.first_clicked_trail_id = None
            st.session_state.selected_trail_id = None

    # Show info message when no trails exist
    if not st.session_state.trails:
        st.info("📍 No trails yet. Upload a GPX file to get started!")

# Sidebar: Show selected trail actions (AFTER click handler)
logger.debug("Sidebar rendering, selected_trail_id = %s", st.session_state.get("selected_trail_id"))
with st.sidebar:
    if st.session_state.get("selected_trail_id"):
        selected_trail = next(
            (t for t in st.session_state.trails if t.trail_id == st.session_state.selected_trail_id), None
        )
        logger.debug("Found selected trail: %s", selected_trail.name if selected_trail else "None")
        if selected_trail:
            st.divider()
            st.subheader("📍 Selected Trail")

            # Display trail name
            st.write(f"**{selected_trail.name}**")

            # Status toggle for planned hikes only
            if selected_trail.source == "planned_hikes":
                st.divider()
                current_status_is_explored = selected_trail.status == "Explored!"
                new_status_toggle = st.toggle(
                    "Mark as Explored",
                    value=current_status_is_explored,
                    key=f"status_toggle_{selected_trail.trail_id}",
                    help="Toggle exploration status for this planned hike",
                )

                # Check if status changed
                if new_status_toggle != current_status_is_explored:
                    new_status = "Explored!" if new_status_toggle else "To Explore"
                    try:
                        update_trail_status(selected_trail.trail_id, new_status)
                        selected_trail.status = new_status
                        st.success(f"✅ Status updated to: {new_status}")
                        load_all_trails.clear()  # Invalidate cache
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Failed to update status: {e}")

            # Rename section
            with st.form(key="rename_trail_form"):
                new_name = st.text_input("Rename trail:", value=selected_trail.name, label_visibility="visible")
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
                        load_all_trails.clear()  # Invalidate cache after update
                        st.session_state.selected_trail_id = None  # Clear selection after rename
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
                                load_all_trails.clear()  # Invalidate cache after deletion
                                st.rerun()
                            except Exception as e:
                                st.error(f"❌ Failed to delete: {e}")
                        else:
                            st.error("Please check the confirmation box to delete")
