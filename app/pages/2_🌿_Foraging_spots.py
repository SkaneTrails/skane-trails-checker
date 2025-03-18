import streamlit as st
import folium
from streamlit_folium import st_folium
import pandas as pd
import os
import json
from datetime import datetime
import plotly.express as px
import requests

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
    unsafe_allow_html=True
)

st.header("🍄 Seasonal Foraging Tracker")

# Define foraging types and their colors
foraging_types = {
    "Blueberries": {"icon": "🫐", "color": "blue"},
    "Raspberries": {"icon": "🍓", "color": "red"},
    "Mushrooms": {"icon": "🍄", "color": "brown"},
    "Wild Garlic": {"icon": "🧄", "color": "green"},
    "Nuts": {"icon": "🌰", "color": "saddlebrown"},
    "Herbs": {"icon": "🌿", "color": "darkgreen"},
    "Apples": {"icon": "🍎", "color": "red"},
    "Other": {"icon": "🌱", "color": "gray"}
}

# Short month names
short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Define file paths (use relative paths for better portability)
data_directory = "app/foraging_data"
csv_data_path = os.path.join(data_directory, "foraging_data.csv")

# Create data directory if it doesn't exist
os.makedirs(data_directory, exist_ok=True)

# Load foraging data from CSV file
@st.cache_data(show_spinner=False)
def load_foraging_data():
    if os.path.exists(csv_data_path):
        try:
            df = pd.read_csv(csv_data_path)
            # Convert dataframe to dictionary format for compatibility with existing code
            data_dict = {month: [] for month in short_months}
            
            for _, row in df.iterrows():
                item = {
                    "type": row['type'],
                    "lat": row['lat'],
                    "lng": row['lng'],
                    "notes": row['notes'],
                    "date": row['date']
                }
                data_dict[row['month']].append(item)
            
            return data_dict
        except Exception as e:
            st.warning(f"Could not load data: {e}")
            return {month: [] for month in short_months}
    else:
        return {month: [] for month in short_months}

# Save foraging data to CSV file
def save_foraging_data(data_dict):
    # Convert dictionary to dataframe
    rows = []
    for month, items in data_dict.items():
        for item in items:
            rows.append({
                'month': month,
                'type': item['type'],
                'lat': item['lat'],
                'lng': item['lng'],
                'notes': item['notes'],
                'date': item['date']
            })
    
    df = pd.DataFrame(rows)
    
    # Make sure the directory exists
    os.makedirs(os.path.dirname(csv_data_path), exist_ok=True)
    
    # Save to CSV
    try:
        df.to_csv(csv_data_path, index=False)
        return True
    except Exception as e:
        st.error(f"Error saving data: {e}")
        return False

# Initialize or load foraging data
if "foraging_data" not in st.session_state:
    st.session_state.foraging_data = load_foraging_data()

# Create tabs
tab1, tab2 = st.tabs(["🌍 Foraging Map", "📅 Yearly Overview"])

# Tab 1: Interactive Map
with tab1:
    selected_month_idx = st.select_slider(
        "Select Month:",
        options=range(len(short_months)),
        format_func=lambda x: short_months[x],
        value=datetime.now().month - 1  # Default to current month
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
            icon_html = f"""
                <div style="font-size: 24px; text-align: center;">
                    {foraging_types[item['type']]['icon']}
                </div>
            """  # Add emoji inside the marker

            folium.Marker(
                location=[item['lat'], item['lng']],
                tooltip=item['type'],
                popup=f"<b>{item['type']}</b><br>{item['notes']}<br>Added: {item['date']}",
                icon=folium.DivIcon(html=icon_html)  # Custom icon using emoji
            ).add_to(m)

        # Display the map
        map_data = st_folium(m, height=600, width="100%", key=f"foraging_map_{selected_month}")
        
        # Show a legend for the icons
        st.write("### Legend:")
        legend_cols = st.columns(4)
        for i, (item_type, details) in enumerate(foraging_types.items()):
            col_idx = i % 4
            legend_cols[col_idx].write(f"{details['icon']} {item_type}")

    # Control panel in the right column
    with control_col:
        st.write(f"### Add Foraging Spot")
        st.write(f"Month: **{selected_month}**")
        
        # Select foraged item type
        forage_type = st.selectbox("Item Type:", list(foraging_types.keys()))
        
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
                    "date": datetime.now().strftime("%Y-%m-%d")
                }
                
                st.session_state.foraging_data[selected_month].append(new_spot)
                success = save_foraging_data(st.session_state.foraging_data)
                if success:
                    st.success(f"✅ Added {forage_type} to {selected_month} map!")
                    # Clear the cache to ensure fresh data is loaded
                    st.cache_data.clear()
                    st.rerun()  # Refresh to show the new marker
            else:
                st.error("Please select a location on the map or enter coordinates.")
        
        # Show spots for the current month
        st.write(f"### {selected_month} Spots ({len(st.session_state.foraging_data[selected_month])})")
        if st.session_state.foraging_data[selected_month]:
            for i, item in enumerate(st.session_state.foraging_data[selected_month]):
                st.write(f"{foraging_types[item['type']]['icon']} **{item['type']}**")
                
            if st.button("Clear All Spots for This Month"):
                st.session_state.foraging_data[selected_month] = []
                save_foraging_data(st.session_state.foraging_data)
                # Clear the cache to ensure fresh data is loaded
                st.cache_data.clear()
                st.success(f"Cleared all spots for {selected_month}")
                st.rerun()
        else:
            st.write("No foraging spots recorded for this month.")

# Tab 2: Yearly Overview
with tab2: 
    # Foraging data per month with icons
    foraging_calendar = {
        "Jan": ["None"], "Feb": ["None"], "Mar": ["🧄 Wild Garlic"], "Apr": ["🧄 Wild Garlic", "🌿 Herbs"],
        "May": ["🫐 Berries", "🧄 Wild Garlic"], "Jun": ["🫐 Berries", "🌰 Nuts"], "Jul": ["🫐 Berries", "🍄 Mushrooms"],
        "Aug": ["🍄 Mushrooms", "🍎 Apples"], "Sep": ["🍄 Mushrooms", "🍎 Apples", "🌿 Herbs"], "Oct": ["🍄 Mushrooms", "🌰 Nuts"],
        "Nov": ["🍄 Mushrooms"], "Dec": ["None"]
    }

    # Create a dataframe for visualization
    df_calendar = pd.DataFrame({
        "Month": list(foraging_calendar.keys()),
        "Items": [", ".join(items) for items in foraging_calendar.values()]
    })

    # Display as table
    st.write("### Seasonal Foraging Availability")
    st.dataframe(df_calendar, height=480)
    
    # Add a download button for the foraging data
    if os.path.exists(csv_data_path):
        with open(csv_data_path, 'r') as f:
            st.download_button(
                label="Download Foraging Data CSV",
                data=f,
                file_name="foraging_data.csv",
                mime="text/csv"
            )
    
    # Add a section to visualize current foraging data
    st.write("### Your Foraging Data")
    
    # Count the number of foraging spots per month
    spot_counts = {month: len(spots) for month, spots in st.session_state.foraging_data.items()}
    
    if any(spot_counts.values()):  # Only show if there's data
        counts_df = pd.DataFrame({
            'Month': list(spot_counts.keys()),
            'Spots': list(spot_counts.values())
        })
        
        # Create a bar chart
        fig = px.bar(
            counts_df, 
            x='Month', 
            y='Spots',
            title='Number of Foraging Spots by Month',
            color='Spots',
            color_continuous_scale='Viridis'
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Show a summary of foraging types
        st.write("### Foraging Type Summary")
        
        # Count by type
        type_counts = {}
        for month, spots in st.session_state.foraging_data.items():
            for spot in spots:
                if spot['type'] not in type_counts:
                    type_counts[spot['type']] = 0
                type_counts[spot['type']] += 1
        
        if type_counts:
            types_df = pd.DataFrame({
                'Type': list(type_counts.keys()),
                'Count': list(type_counts.values())
            })
            
            # Create a pie chart
            fig = px.pie(
                types_df,
                values='Count',
                names='Type',
                title='Foraging Types Distribution',
                color='Type',
                color_discrete_map={k: v['color'] for k, v in foraging_types.items()}
            )
            
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No foraging data recorded yet. Start by adding some foraging spots on the map!")
