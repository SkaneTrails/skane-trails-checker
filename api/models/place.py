"""Pydantic models for place/POI API endpoints."""

from pydantic import BaseModel


class PlaceCategoryResponse(BaseModel):
    """Category information for a place."""

    name: str
    slug: str
    icon: str = ""


class PlaceResponse(BaseModel):
    """Place/POI data returned by the API."""

    place_id: str
    name: str
    lat: float
    lng: float
    categories: list[PlaceCategoryResponse] = []
    address: str = ""
    city: str = ""
    weburl: str = ""
    source: str = "skaneleden"
    last_updated: str = ""


PLACE_CATEGORIES: dict[str, dict[str, str]] = {
    "parkering": {"name": "Parkering", "icon": "🅿️"},
    "vatten": {"name": "Vatten", "icon": "💧"},
    "lagerplats-med-vindskydd": {"name": "Vindskydd", "icon": "⛺"},
    "toalett": {"name": "Toalett", "icon": "🚻"},
    "kollektivtrafik": {"name": "Kollektivtrafik", "icon": "🚌"},
    "boende": {"name": "Boende", "icon": "🏠"},
    "badplats": {"name": "Badplats", "icon": "🏊"},
    "ata-dricka": {"name": "Äta & Dricka", "icon": "🍽️"},
    "livsmedelgardsbutik": {"name": "Livsmedel/Gårdsbutik", "icon": "🛒"},
    "sevardhet": {"name": "Sevärdhet", "icon": "📸"},
    "aktivitet": {"name": "Aktivitet", "icon": "🎯"},
    "turistinformation": {"name": "Turistinformation", "icon": "i"},
    "konst": {"name": "Konst", "icon": "🎨"},
    "naturlekplats": {"name": "Naturlekplats", "icon": "🌳"},
}
