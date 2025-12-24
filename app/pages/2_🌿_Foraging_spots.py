from datetime import UTC, datetime
from pathlib import Path

import folium
import pandas as pd
import plotly.express as px
import streamlit as st
from streamlit_folium import st_folium

from functions.env_loader import load_env_if_needed
from functions.foraging_storage import (
    delete_foraging_spot,
    delete_foraging_type,
    get_foraging_spots,
    get_foraging_types,
    save_foraging_spot,
    save_foraging_type,
)
from resources.foraging_resources import (
    color_options,
    foraging_calendar,
    foraging_items,
    month_to_season,
    nature_emojis,
)

# Load environment variables (with platform precedence)
load_env_if_needed()

st.set_page_config(page_title="Seasonal Foraging Tracker", layout="wide")

# Inject custom CSS for larger tabs
st.markdown(
    """
    <style>
    .sidebar .stTitle {
        font-size: 18px !important; /* Adjust size as needed */
    }
    .stTabs button {
        padding: 12px 24px !important;
        font-size: 20px !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.header("🍄 Seasonal Foraging Tracker")

# Short month names
short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Load foraging types from JSON file

# Initialize or load foraging data and types
if "foraging_data" not in st.session_state:
    # Load from Firestore: organize spots by month
    all_spots = get_foraging_spots()  # Get all spots from Firestore
    foraging_data = {month: [] for month in short_months}
    for spot in all_spots:
        month = spot.get("month")
        if month in foraging_data:
            foraging_data[month].append(spot)
    st.session_state.foraging_data = foraging_data

if "foraging_types" not in st.session_state:
    st.session_state.foraging_types = get_foraging_types()

# Create tabs
tab1, tab2, tab3, tab4 = st.tabs(["🌍 Foraging Map", "📅 Yearly Overview", "⚙️ Manage Types", "📖 Foraging Guide"])

# Tab 1: Interactive Map
with tab1:
    selected_month_idx = st.select_slider(
        "Select Month:",
        options=range(len(short_months)),
        format_func=lambda x: short_months[x],
        value=datetime.now(UTC).month - 1,  # Default to current month
    )

    selected_month = short_months[selected_month_idx]

    # Create columns for map and controls
    map_col, control_col = st.columns([3, 1])

    # Display map in the left column
    with map_col:
        # Initialize map (center on user's location or default)
        m = folium.Map(location=[56.0, 13.5], zoom_start=10)  # Default to Southern Sweden

        # Initialize month data if not present
        if selected_month not in st.session_state.foraging_data:
            st.session_state.foraging_data[selected_month] = []

        for item in st.session_state.foraging_data[selected_month]:
            # Get icon and color, default to "Other" if type no longer exists
            if item["type"] in st.session_state.foraging_types:
                icon_emoji = st.session_state.foraging_types[item["type"]]["icon"]
            else:
                icon_emoji = st.session_state.foraging_types["Other"]["icon"]

            icon_html = f"""
                <div style="font-size: 24px; text-align: center;">
                    {icon_emoji}
                </div>
            """  # Add emoji inside the marker

            folium.Marker(
                location=[item["lat"], item["lng"]],
                tooltip=item["type"],
                popup=f"<b>{item['type']}</b><br>{item['notes']}<br>Added: {item['date']}",
                icon=folium.DivIcon(html=icon_html),  # Custom icon using emoji
            ).add_to(m)

        # Display the map
        map_data = st_folium(m, height=600, width=None, key=f"foraging_map_{selected_month}")

        # Show a legend for the icons
        st.write("### Legend:")
        legend_cols = st.columns(4)
        for i, (item_type, details) in enumerate(st.session_state.foraging_types.items()):
            col_idx = i % 4
            legend_cols[col_idx].write(f"{details['icon']} {item_type}")

    # Control panel in the right column
    with control_col:
        st.write("### Add Foraging Spot")
        st.write(f"Month: **{selected_month}**")

        # Select foraged item type
        forage_type = st.selectbox("Item Type:", list(st.session_state.foraging_types.keys()))

        # Notes about the foraged item
        notes = st.text_area("Notes:", placeholder="Optional description, amount found, quality, etc.")

        # Manual coordinates or click on map
        st.write("### Location")
        st.write("Click on map or enter coordinates:")

        # Manual lat/lng inputs
        col1, col2 = st.columns(2)
        with col1:
            lat = st.number_input("Latitude:", format="%.6f", step=0.000001)
        with col2:
            lng = st.number_input("Longitude:", format="%.6f", step=0.000001)

        # Use clicked location if available from map
        if map_data and "last_clicked" in map_data and map_data["last_clicked"] is not None:
            clicked_lat = map_data["last_clicked"]["lat"]
            clicked_lng = map_data["last_clicked"]["lng"]
            st.write(f"Selected location: {clicked_lat:.6f}, {clicked_lng:.6f}")
            lat = clicked_lat
            lng = clicked_lng

        # Add button
        if st.button("Add Foraging Spot"):
            if lat != 0.0 and lng != 0.0:  # Ensure we have coordinates
                # Add new foraging spot
                new_spot = {
                    "type": forage_type,
                    "lat": lat,
                    "lng": lng,
                    "notes": notes,
                    "month": selected_month,
                    "date": datetime.now(UTC).strftime("%Y-%m-%d"),
                }

                st.session_state.foraging_data[selected_month].append(new_spot)

                # Save to Firestore
                spot_id = save_foraging_spot(new_spot)
                st.success(f"✅ Added {forage_type} to {selected_month} map! (ID: {spot_id})")

                # Clear the cache to ensure fresh data is loaded
                st.cache_data.clear()
                st.rerun()  # Refresh to show the new marker
            else:
                st.error("Please select a location on the map or enter coordinates.")

        # Show spots for the current month
        st.write(f"### {selected_month} Spots ({len(st.session_state.foraging_data[selected_month])})")
        if st.session_state.foraging_data[selected_month]:
            for _i, item in enumerate(st.session_state.foraging_data[selected_month]):
                if item["type"] in st.session_state.foraging_types:
                    icon = st.session_state.foraging_types[item["type"]]["icon"]
                else:
                    icon = st.session_state.foraging_types["Other"]["icon"]
                st.write(f"{icon} **{item['type']}**")

            if st.button("Clear All Spots for This Month"):
                # Delete all spots for this month from Firestore
                spots_to_delete = get_foraging_spots(month=selected_month)
                for spot in spots_to_delete:
                    if "id" in spot:
                        delete_foraging_spot(spot["id"])
                st.session_state.foraging_data[selected_month] = []
                st.success(f"Cleared all spots for {selected_month}")

                # Clear the cache to ensure fresh data is loaded
                st.cache_data.clear()
                st.rerun()
        else:
            st.write("No foraging spots recorded for this month.")

# Tab 2: Yearly Overview
with tab2:
    # Create a dataframe for visualization
    df_calendar = pd.DataFrame(
        {"Month": list(foraging_calendar.keys()), "Items": [", ".join(items) for items in foraging_calendar.values()]}
    )

    # Display as table
    st.write("### Seasonal Foraging Availability")
    st.dataframe(df_calendar, height=480)

    # Add a section to visualize current foraging data
    st.write("### Your Foraging Data")

    # Count the number of foraging spots per month
    spot_counts = {month: len(spots) for month, spots in st.session_state.foraging_data.items()}

    if any(spot_counts.values()):  # Only show if there's data
        counts_df = pd.DataFrame({"Month": list(spot_counts.keys()), "Spots": list(spot_counts.values())})

        # Create a bar chart
        fig = px.bar(
            counts_df,
            x="Month",
            y="Spots",
            title="Number of Foraging Spots by Month",
            color="Spots",
            color_continuous_scale="Viridis",
        )

        st.plotly_chart(fig, use_container_width=True)

        # Show a summary of foraging types
        st.write("### Foraging Type Summary")

        # Count by type
        type_counts = {}
        for spots in st.session_state.foraging_data.values():
            for spot in spots:
                if spot["type"] not in type_counts:
                    type_counts[spot["type"]] = 0
                type_counts[spot["type"]] += 1

        if type_counts:
            types_df = pd.DataFrame({"Type": list(type_counts.keys()), "Count": list(type_counts.values())})

            # Create a pie chart with colors from foraging_types when available
            color_map = {}
            for k in type_counts:
                if k in st.session_state.foraging_types:
                    color_map[k] = st.session_state.foraging_types[k]["color"]
                else:
                    color_map[k] = "gray"  # Default color

            fig = px.pie(
                types_df,
                values="Count",
                names="Type",
                title="Foraging Types Distribution",
                color="Type",
                color_discrete_map=color_map,
            )

            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No foraging data recorded yet. Start by adding some foraging spots on the map!")

# Tab 3: Manage Foraging Types
with tab3:
    st.write("### Manage Foraging Types")
    st.write("Here you can add new foraging types or edit existing ones.")

    # Display current foraging types
    st.write("#### Current Foraging Types")

    # Create a grid to display current types
    cols = st.columns(4)
    for i, (type_name, type_info) in enumerate(st.session_state.foraging_types.items()):
        with cols[i % 4]:
            st.write(f"{type_info['icon']} **{type_name}**")
            st.write(f"Color: {type_info['color']}")

    st.write("---")

    # Add new foraging type
    st.write("#### Add New Foraging Type")

    # Input for new type
    new_type_name = st.text_input("Type Name:", placeholder="e.g., Wild Strawberries")

    # Select emoji for new type
    st.write("Select an emoji:")
    emoji_cols = st.columns(10)
    selected_emoji = st.session_state.get("selected_emoji", "🌱")  # Default emoji

    # Create emoji grid
    for i, emoji in enumerate(nature_emojis):
        col_idx = i % 10
        if emoji_cols[col_idx].button(emoji, key=f"emoji_{i}"):
            selected_emoji = emoji
            st.session_state.selected_emoji = emoji

    st.write(f"Selected emoji: {selected_emoji}")

    # Select color for new type
    selected_color = st.selectbox(
        "Select color:", options=list(color_options.keys()), format_func=lambda x: color_options[x]
    )

    # Add button
    if st.button("Add New Foraging Type"):
        if new_type_name and new_type_name not in st.session_state.foraging_types:
            st.session_state.foraging_types[new_type_name] = {"icon": selected_emoji, "color": selected_color}

            # Save to Firestore
            save_foraging_type(new_type_name, {"icon": selected_emoji, "color": selected_color})
            st.success(f"✅ Added new foraging type: {selected_emoji} {new_type_name}")

            st.cache_data.clear()
            st.rerun()
        elif not new_type_name:
            st.error("Please enter a name for the new foraging type.")
        else:
            st.error(f"A foraging type named '{new_type_name}' already exists.")

    st.write("---")

    # Delete a foraging type
    st.write("#### Remove Foraging Type")
    st.write("⚠️ Warning: Removing a type will not delete existing spots but they will use the 'Other' icon.")

    # Don't allow deleting the "Other" type
    delete_options = [t for t in st.session_state.foraging_types if t != "Other"]
    if delete_options:
        type_to_delete = st.selectbox("Select type to remove:", options=delete_options)

        if st.button("Remove Type"):
            if type_to_delete in st.session_state.foraging_types and type_to_delete != "Other":
                del st.session_state.foraging_types[type_to_delete]

                # Delete from Firestore
                delete_foraging_type(type_to_delete)
                st.success(f"✅ Removed foraging type: {type_to_delete}")

                st.cache_data.clear()
                st.rerun()
            else:
                st.error("Cannot remove the 'Other' type as it's used as a fallback.")
    else:
        st.info("No custom types to remove.")

# Tab 4: Foraging Guide
with tab4:
    st.write("# 📖 Skåne Foraging Guide")
    st.write(
        "Explore the rich variety of edible plants, mushrooms, and berries you can forage in Skåne. This guide provides information on identification, seasonality, and how to prepare your finds."
    )

    # Create filter for types of forageable items
    item_types = ["All", *sorted({item.get("name", "").split(" ")[0] for item in foraging_items if item.get("name")})]
    selected_type = st.selectbox("Filter by type:", item_types)

    # Apply filter
    if selected_type != "All":
        filtered_items = [item for item in foraging_items if item.get("name", "").startswith(selected_type)]
    else:
        filtered_items = foraging_items

    # Month-based seasonal filter
    current_month = datetime.now(UTC).strftime("%B")

    # Add checkbox for "Show only in-season items"
    show_in_season = st.checkbox("Show only items in season now", value=False)

    if show_in_season:
        # Filter items by current month
        current_month_variations = month_to_season[current_month]
        in_season_items = []
        for item in filtered_items:
            season = item["season"]
            if any(month in season for month in current_month_variations):
                in_season_items.append(item)
        filtered_items = in_season_items

    # Display foraging guide items
    for item in filtered_items:
        st.write(f"## {item['emoji']} {item['name']}")
        st.write(f"**Season:** {item['season']}")

        # Create two columns for image and description
        col1, col2 = st.columns([1, 2])
        with col1:
            # Then in your display code
            st.image(item["image_url"], caption=item["name"], width=400)

        with col2:
            st.write("### Description")
            st.write(item["description"])

            st.write("### How to Use")
            st.write(item["usage"])

        st.write("---")

    if not filtered_items:
        st.info("No foraging items match your current filters.")

    # Add a section with general foraging tips and safety advice
    with st.expander("Foraging Safety Tips", expanded=False):
        st.write("""
        ### Important Safety Tips for Foraging

        1. **Never eat anything unless you are 100% certain of its identity**. When in doubt, leave it out!
        2. **Use multiple identification sources** - cross-reference with guidebooks, apps, and expert advice.
        3. **Start with easily identifiable species** with few or no poisonous look-alikes.
        4. **Forage in clean areas** away from roads, industrial sites, and areas that might be sprayed with pesticides.
        5. **Respect nature** - never take more than you need, and leave plenty to regrow and for wildlife.
        6. **Be aware of regulations** - some areas may have restrictions on foraging, especially in nature reserves.
        7. **Introduce new foods gradually** in small quantities to check for allergic reactions.
        8. **When foraging mushrooms**, learn about the deadly toxic species in your area before collecting any edible ones.

        Remember: The joy of foraging comes from connecting with nature safely and responsibly.
        """)

    # Add further learning resources
    with st.expander("Further Learning", expanded=False):
        st.write("""
        ### Resources for Foraging in Skåne

        #### Books
        - "Wildpicking: A Guide to the Edible Plants of Sweden" by Ingvar Svanberg
        - "Nordic Foraging" by Lisa Förare Winbladh
        - "Food from the Forest" by Lisbeth Svensson

        #### Apps
        - "Wild Food UK"
        - "Picture Mushroom"
        - "PlantNet" for plant identification

        #### Local Courses and Guided Tours
        - Skånes Friluftsfrämjandet often arranges foraging walks
        - Naturskyddsföreningen in Skåne offers seasonal foraging courses
        - Malmö Museum occasionally hosts workshops on wild edibles

        #### Websites
        - Naturhistoriska riksmuseet (Swedish Museum of Natural History)
        - Swedish Environmental Protection Agency guidelines on foraging
        """)
