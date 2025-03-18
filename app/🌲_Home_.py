
import streamlit as st
import requests
from datetime import datetime, timedelta
import random
from datetime import datetime

# Set page config (shared across pages)
st.set_page_config(
    page_title="Our Skåne app",
    layout="wide",
    page_icon="🇸🇪"
)


# Function to get weather data
def get_weather():
    lat, lon = 56.0, 13.5  # Default location (Southern Sweden)
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto"
    response = requests.get(weather_url)
    if response.status_code == 200:
        return response.json()
    return None

# Title
st.title("🌿 Skåne Outdoor Hub 🌲")

# Weather Forecast
st.subheader("🌤️ Weather Forecast for the Next 3 Days")
weather_data = get_weather()

if weather_data:
    dates = weather_data["daily"]["time"]
    max_temps = weather_data["daily"]["temperature_2m_max"]
    min_temps = weather_data["daily"]["temperature_2m_min"]
    precipitation = weather_data["daily"]["precipitation_sum"]

    cols = st.columns(4)  # Create 4 columns for Today + Next 3 Days

    for i in range(4):
        date = datetime.strptime(dates[i], "%Y-%m-%d").strftime("%A, %b %d")
        max_temp = max_temps[i]
        min_temp = min_temps[i]
        rain = precipitation[i]

        with cols[i]:  # Display each day's forecast in a separate card
            st.markdown(
                f"""
                <div style="padding: 10px; border-radius: 10px; background-color: #464239; text-align: center;">
                    <h4>{date}</h4>
                    <p>🌡️ {min_temp}°C - {max_temp}°C</p>
                    <p>🌧️ {rain} mm rain</p>
                </div>
                """, 
                unsafe_allow_html=True
            )

else:
    st.warning("Could not fetch weather data. Please check the API.")


st.markdown("<br>", unsafe_allow_html=True) 
st.markdown("<br>", unsafe_allow_html=True) 
st.markdown("<br>", unsafe_allow_html=True) 



# Expanded list of hiking tips
hiking_tips = [
    "Always carry a map or GPS when hiking in unfamiliar areas.",
    "Dress in layers to stay comfortable in changing weather.",
    "Check the weather before heading out on your hike.",
    "Stay hydrated – bring plenty of water on your adventure!",
    "Respect nature – leave no trace and take only memories.",
    "Pack high-energy snacks for long hikes.",
    "Wear comfortable and weather-appropriate hiking shoes.",
    "Know your route before you start your hike.",
    "Hike with a buddy or let someone know your plans.",
    "Bring a small first-aid kit for emergencies.",
    "Start early in the day to make the most of daylight.",
    "Keep a steady pace and take breaks when needed.",
    "Learn to identify edible wild plants and berries.",
    "Bring a whistle and flashlight for safety.",
    "Use trekking poles for extra stability on rough trails.",
    "Enjoy the journey – stop and take in the scenery!"
]

# Expanded list of outdoor inspiration quotes
outdoor_quotes = [
    "'In every walk with nature, one receives far more than he seeks.' – John Muir",
    "'The best view comes after the hardest climb.' – Unknown",
    "'Take only memories, leave only footprints.' – Chief Seattle",
    "'The mountains are calling, and I must go.' – John Muir",
    "'Nature does not hurry, yet everything is accomplished.' – Lao Tzu",
    "'Look deep into nature, and then you will understand everything better.' – Albert Einstein",
    "'Adventure is worthwhile in itself.' – Amelia Earhart",
    "'Over every mountain, there is a path, although it may not be seen from the valley.' – Theodore Roethke",
    "'Not all those who wander are lost.' – J.R.R. Tolkien",
    "'He who climbs upon the highest mountains laughs at all tragedies, real or imaginary.' – Friedrich Nietzsche",
    "'Go where you feel most alive.' – Unknown",
    "'Nature is not a place to visit. It is home.' – Gary Snyder",
    "'A walk in nature walks the soul back home.' – Mary Davis",
    "'To walk in nature is to witness a thousand miracles.' – Mary Davis"
]

# Expanded list of foraging tips
foraging_tips = [
    "Always carry a foraging knife to safely harvest plants and mushrooms.",
    "Be 100% sure of what you're foraging – never eat something you're unsure of.",
    "Respect the environment and only take what you need.",
    "Harvest in the morning when plants and mushrooms are at their freshest.",
    "Take note of where you find foraged items – it will help in the future.",
    "Avoid foraging near busy roads or polluted areas.",
    "Check the seasons and ensure you’re foraging at the right time for each item.",
    "Bring a basket or breathable bag to store foraged food.",
    "Learn about local laws regarding foraging to stay legal.",
    "Forage sustainably – don’t overharvest from any one spot.",
    "Use a field guide or an app to help identify safe and edible species.",
    "Check the weather before foraging; mushrooms grow best in moist, cool conditions.",
    "Be aware of poisonous look-alikes, especially in mushrooms and berries.",
    "Try foraging with a local expert to learn more about edible plants and fungi.",
    "Leave some plants behind to ensure their population continues to thrive."
]

# Expanded list of preserving foraged food tips
preservation_tips = [
    "Dry herbs by hanging them upside down in a cool, dark place.",
    "Freeze berries and mushrooms in single layers before sealing them in bags.",
    "Ferment wild vegetables for a unique flavor and longer shelf life.",
    "Make jams and jellies with foraged fruits to enjoy later in the year.",
    "Pickle wild vegetables for a crunchy, tangy snack all year long.",
    "Dehydrate mushrooms to preserve their flavor – perfect for soups and stews.",
    "Store dried herbs in airtight containers to keep them fresh and potent.",
    "Forage early in the season and preserve excess for later use.",
    "Use natural wax wraps or jars to preserve wild nuts.",
    "Preserve berries by making syrups or fruit leathers.",
    "Forage and preserve wild garlic by turning it into a pesto or dried powder.",
    "Forage and freeze mushrooms with butter to preserve their flavor and texture.",
    "Make wild herb oils by infusing olive oil with foraged herbs.",
    "Use salt to preserve foraged mushrooms by drying and salting them.",
    "Make tinctures with wild herbs to keep their medicinal properties throughout the year."
]

# Select random tips
random_hiking_tip = random.choice(hiking_tips)
random_quote = random.choice(outdoor_quotes)
random_foraging_tip = random.choice(foraging_tips)
random_preservation_tip = random.choice(preservation_tips)

# Create two columns
col1, col2 = st.columns(2)

# Column 1: Display Hiking Tip
with col1:
    st.subheader("💡 Hiking Tip of the Day")
    st.write(f"{random_hiking_tip}")

# Column 2: Display Outdoor Inspiration
with col2:
    st.subheader("🌟 Outdoor Inspiration")
    st.write(f"**{random_quote}**")

# Create space between sections
st.markdown("<br>", unsafe_allow_html=True)

# Create two columns again for the next pair
col1, col2 = st.columns(2)

# Column 1: Display Foraging Tip
with col1:
    st.subheader("🍄 Foraging Tip of the Day")
    st.write(f"{random_foraging_tip}")

# Column 2: Display Preservation Tip
with col2:
    st.subheader("🥒 Preservation Tip of the Day")
    st.write(f"{random_preservation_tip}")
