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

# Define nature emojis for selection
nature_emojis = [
    "🍄", "🌿", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌸", "🌼", "🌻", "🌺", "🌹", "🌷", "🍀", 
    "🍁", "🍂", "🍃", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🍎", "🍏", "🍐", "🍑", "🍒", 
    "🍓", "🥝", "🥥", "🥑", "🥔", "🥕", "🥒", "🌽", "🍅", "🍆", "🌶️", "🫑", "🌰", "🧄", "🧅", 
    "🫐", "🫒", "🥭", "🍠", "🥦", "🥬", "🍄", "🦌", "🐚", "🐌", "🐝", "🦋", "🐞", "🏞️", "⛰️"
]

# Define default foraging types and their colors
default_foraging_types = {
    "Blueberries": {"icon": "🫐", "color": "blue"},
    "Raspberries": {"icon": "🍓", "color": "red"},
    "Mushrooms": {"icon": "🍄", "color": "brown"},
    "Wild Garlic": {"icon": "🧄", "color": "green"},
    "Nuts": {"icon": "🌰", "color": "saddlebrown"},
    "Herbs": {"icon": "🌿", "color": "darkgreen"},
    "Apples": {"icon": "🍎", "color": "red"},
    "Other": {"icon": "🌱", "color": "gray"}
}

# Define color options
color_options = {
    "red": "Red",
    "blue": "Blue",
    "green": "Green",
    "yellow": "Yellow",
    "orange": "Orange",
    "purple": "Purple",
    "pink": "Pink",
    "brown": "Brown",
    "black": "Black",
    "gray": "Gray",
    "darkgreen": "Dark Green",
    "saddlebrown": "Saddle Brown",
    "navy": "Navy",
    "teal": "Teal",
    "olive": "Olive",
    "maroon": "Maroon"
}

# Short month names
short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Define file paths (use relative paths for better portability)
data_directory = "app/foraging_data"
csv_data_path = os.path.join(data_directory, "foraging_data.csv")
foraging_types_path = os.path.join(data_directory, "foraging_types.json")

# Create data directory if it doesn't exist
os.makedirs(data_directory, exist_ok=True)

# Load foraging types from JSON file
@st.cache_data(show_spinner=False)
def load_foraging_types():
    if os.path.exists(foraging_types_path):
        try:
            with open(foraging_types_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            st.warning(f"Could not load foraging types: {e}")
            return default_foraging_types
    else:
        return default_foraging_types

# Save foraging types to JSON file
def save_foraging_types(foraging_types):
    try:
        with open(foraging_types_path, 'w') as f:
            json.dump(foraging_types, f)
        return True
    except Exception as e:
        st.error(f"Error saving foraging types: {e}")
        return False

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

# Initialize or load foraging data and types
if "foraging_data" not in st.session_state:
    st.session_state.foraging_data = load_foraging_data()

if "foraging_types" not in st.session_state:
    st.session_state.foraging_types = load_foraging_types()

# Create tabs
tab1, tab2, tab3, tab4 = st.tabs(["🌍 Foraging Map", "📅 Yearly Overview", "⚙️ Manage Types", "📖 Foraging Guide"])

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
            # Get icon and color, default to "Other" if type no longer exists
            if item['type'] in st.session_state.foraging_types:
                icon_emoji = st.session_state.foraging_types[item['type']]['icon']
            else:
                icon_emoji = st.session_state.foraging_types['Other']['icon']
                
            icon_html = f"""
                <div style="font-size: 24px; text-align: center;">
                    {icon_emoji}
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
        i = 0
        for item_type, details in st.session_state.foraging_types.items():
            col_idx = i % 4
            legend_cols[col_idx].write(f"{details['icon']} {item_type}")
            i += 1

    # Control panel in the right column
    with control_col:
        st.write(f"### Add Foraging Spot")
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
                if item['type'] in st.session_state.foraging_types:
                    icon = st.session_state.foraging_types[item['type']]['icon']
                else:
                    icon = st.session_state.foraging_types['Other']['icon']
                st.write(f"{icon} **{item['type']}**")
                
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
            
            # Create a pie chart with colors from foraging_types when available
            color_map = {}
            for k in type_counts.keys():
                if k in st.session_state.foraging_types:
                    color_map[k] = st.session_state.foraging_types[k]['color']
                else:
                    color_map[k] = 'gray'  # Default color
                    
            fig = px.pie(
                types_df,
                values='Count',
                names='Type',
                title='Foraging Types Distribution',
                color='Type',
                color_discrete_map=color_map
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
    selected_emoji = st.session_state.get('selected_emoji', "🌱")  # Default emoji
    
    # Create emoji grid
    for i, emoji in enumerate(nature_emojis):
        col_idx = i % 10
        if emoji_cols[col_idx].button(emoji, key=f"emoji_{i}"):
            selected_emoji = emoji
            st.session_state.selected_emoji = emoji
    
    st.write(f"Selected emoji: {selected_emoji}")
    
    # Select color for new type
    selected_color = st.selectbox("Select color:", options=list(color_options.keys()), 
                                format_func=lambda x: color_options[x])
    
    # Add button
    if st.button("Add New Foraging Type"):
        if new_type_name and new_type_name not in st.session_state.foraging_types:
            st.session_state.foraging_types[new_type_name] = {
                "icon": selected_emoji,
                "color": selected_color
            }
            
            # Save updated foraging types
            success = save_foraging_types(st.session_state.foraging_types)
            if success:
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
    delete_options = [t for t in st.session_state.foraging_types.keys() if t != "Other"]
    if delete_options:
        type_to_delete = st.selectbox("Select type to remove:", options=delete_options)
        
        if st.button("Remove Type"):
            if type_to_delete in st.session_state.foraging_types and type_to_delete != "Other":
                del st.session_state.foraging_types[type_to_delete]
                success = save_foraging_types(st.session_state.foraging_types)
                if success:
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
    st.write("Explore the rich variety of edible plants, mushrooms, and berries you can forage in Skåne. This guide provides information on identification, seasonality, and how to prepare your finds.")
    
    # Define the foraging items with details
    foraging_items = [
        {
            "name": "Chanterelle Mushroom (Kantarell)",
            "emoji": "🍄",
            "season": "July to October",
            "image_url": "app\media\cantarelle.jpg",
            "description": "The chanterelle is a golden-yellow funnel-shaped mushroom with a fruity smell and a mild, peppery taste. They're commonly found in deciduous and coniferous forests, especially near oak, beech, and pine trees.",
            "usage": "Clean with a brush or knife (avoid washing). Sauté in butter with salt and pepper, or add to soups, sauces, and risottos. Can be dried or frozen after pre-cooking."
        },
        {
            "name": "Blueberries (Blåbär)",
            "emoji": "🫐",
            "season": "July to August",
            "image_url": "app\media\\blueberries.jpg",
            "description": "Wild blueberries in Skåne are smaller and more flavorful than cultivated ones. They grow on low bushes in forests, especially in areas with acidic soil. The European blueberry (bilberry) has a dark blue, almost black color with a reddish-purple flesh.",
            "usage": "Eat fresh, use in pies, jams, smoothies, or desserts. They can be frozen whole or made into preserves. Traditional Swedish dishes include blåbärssoppa (blueberry soup) and blåbärspaj (blueberry pie)."
        },
        {
            "name": "Wild Garlic (Ramslök)",
            "emoji": "🧄",
            "season": "March to May",
            "image_url": "app\media\wild_garlic.jpg",
            "description": "Wild garlic has broad, lily-of-the-valley-like leaves and white star-shaped flowers. It grows in deciduous woodland with moist soils, often near streams. The leaves have a strong garlic smell when crushed. CAUTION: Can be confused with lily-of-the-valley, which is poisonous.",
            "usage": "Use the leaves fresh in salads, pesto, butter, soups, and as a herb in cooking. Best harvested before flowering. Preserves well in oil, vinegar, or frozen in butter or as pesto."
        },
        {
            "name": "Lingonberries (Lingon)",
            "emoji": "🍒",
            "season": "August to October",
            "image_url": "app\media\lingonberries.jpg",
            "description": "Small, red berries that grow on low evergreen shrubs in forests, particularly pine forests with acidic soil. Lingonberries are tart and slightly bitter when raw but sweeten when cooked.",
            "usage": "Traditionally served as lingonsylt (lingonberry jam) with Swedish meatballs, pancakes, and other dishes. Can be used in sauces, compotes, and desserts. They preserve well due to natural benzoic acid."
        },
        {
            "name": "Wild Raspberries (Vilda hallon)",
            "emoji": "🍓",
            "season": "July to August",
            "image_url": "app\media\hallon.jpg",
            "description": "Wild raspberries are smaller but often more flavorful than cultivated varieties. They grow on thorny bushes in forest clearings, roadsides, and abandoned fields. Look for the distinctive cup shape left when picking.",
            "usage": "Delicious eaten fresh, added to desserts, or made into jam. They freeze well for later use. Can also be used to make cordials, vinegar, or infused into spirits."
        },
        {
            "name": "Nettle (Brännässla)",
            "emoji": "🌿",
            "season": "April to October (best in spring)",
            "image_url": "app\media\\nettle.jpg",
            "description": "Stinging nettles grow abundantly in Skåne. Young plants are best for cooking. Wear gloves when harvesting to avoid the sting. Rich in vitamins A and C, iron, and protein.",
            "usage": "Cooking removes the sting. Use young leaves like spinach in soups, pasta, pesto, or tea. Blanch briefly before using in other recipes. Can be dried for winter use as tea or seasoning."
        },
        {
            "name": "Sheep Sorrel (Ängssyra)",
            "emoji": "🌱",
            "season": "April to September",
            "image_url": "app\media\sheep-sorrel.jpg",
            "description": "Sheep sorrel has arrow-shaped leaves and a lemony, acidic taste. Common in meadows, pastures, and along paths. The leaves are rich in vitamin C and oxalic acid.",
            "usage": "Use sparingly in salads, soups, or as a garnish due to its strong flavor and oxalic acid content. Excellent in small amounts for adding a citrusy tang to fish dishes or mixed with milder greens."
        },
        {
            "name": "Beech Nuts (Bokollon)",
            "emoji": "🌰",
            "season": "September to October",
            "image_url": "app\media\\bokollon.jpg",
            "description": "Small triangular nuts found in the distinctive spiny husks beneath beech trees, which are common throughout Skåne. They have a mild, sweet taste similar to hazelnuts when fresh.",
            "usage": "Can be eaten raw but are better roasted to improve digestibility. Use as you would other nuts in baking or cooking, or roast and grind as a coffee substitute. High in fat and protein."
        },
        {
            "name": "Karl Johan Mushroom (Karljohansvamp)",
            "emoji": "🍄",
            "season": "August to October",
            "image_url": "app\media\Karljohansvamp.jpg",
            "description": "The Karl Johan mushroom (Boletus edulis) is prized for its rich, nutty flavor. It has a brown cap, thick stem, and white to yellowish pores underneath instead of gills. Found in mixed forests, especially near pine and spruce trees. The firm flesh stays white when cut, which helps distinguish it from less desirable Boletes.",
            "usage": "One of Sweden's most valued edible mushrooms. Excellent sautéed in butter, added to risottos, or dried for later use (where the flavor intensifies). The stems can be slightly tough but are good for stocks and sauces. Can be dried, frozen, or pickled for preservation."
        },
        {
            "name": "Russula Mushrooms (Kremlor)",
            "emoji": "🍄",
            "season": "July to October",
            "image_url": "app\media\kremlor.jpg",
            "description": "Russulas are common in Skåne forests and come in many colors - red, green, purple, yellow. They have brittle flesh that breaks like chalk. The edible species include Russula vesca (Bare-toothed Russula) and Russula integra (Entire Russula). CAUTION: Some Russulas are inedible or cause stomach upset - proper identification is essential.",
            "usage": "The mild-tasting edible varieties can be sautéed, added to mushroom mixes, or used in soups and stews. They have a more delicate flavor than many other wild mushrooms. Russulas don't preserve as well as some mushrooms but can be dried or pickled. A good rule is to taste a tiny bit of cap - if it's not bitter or hot, it's likely edible once cooked."
        }
    ]
    
    # Create filter for types of forageable items
    item_types = ["All"] + sorted(list(set([item.get("name").split(" ")[0] for item in foraging_items])))
    selected_type = st.selectbox("Filter by type:", item_types)
    
    # Apply filter
    if selected_type != "All":
        filtered_items = [item for item in foraging_items if item.get("name").startswith(selected_type)]
    else:
        filtered_items = foraging_items
    
    # Month-based seasonal filter
    current_month = datetime.now().strftime("%B")
    
    # Create month mapping to match season descriptions
    month_to_season = {
        "January": ["January", "Jan"],
        "February": ["February", "Feb"],
        "March": ["March", "Mar"],
        "April": ["April", "Apr"],
        "May": ["May"],
        "June": ["June", "Jun"],
        "July": ["July", "Jul"],
        "August": ["August", "Aug"],
        "September": ["September", "Sep"],
        "October": ["October", "Oct"],
        "November": ["November", "Nov"],
        "December": ["December", "Dec"]
    }
    
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
            st.image(item['image_url'], caption=item['name'], width=400)
        
        with col2:
            st.write("### Description")
            st.write(item['description'])
            
            st.write("### How to Use")
            st.write(item['usage'])
        
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

    # Add a way for users to contribute
    st.write("### Contribute to the Guide")
    st.write("Have knowledge about local foraging spots or items not listed here? Share your expertise!")
    
    with st.form("contribution_form"):
        contrib_name = st.text_input("Your Name (optional)")
        contrib_item = st.text_input("Foraging Item Name")
        contrib_season = st.text_input("Season/Months Available")
        contrib_location = st.text_input("General Location in Skåne")
        contrib_notes = st.text_area("Notes (identification tips, usage ideas, etc.)")
        
        submit_button = st.form_submit_button("Submit Contribution")
        
        if submit_button:
            # In a real app, this would save to a database or send an email
            st.success("Thank you for your contribution! After review, it may be added to the guide.")