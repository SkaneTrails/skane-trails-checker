"""Pydantic models for place/POI API endpoints."""

from pydantic import BaseModel


class PlaceCategoryResponse(BaseModel):
    """Category information for a place."""

    name: str
    slug: str
    icon: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        return {"name": self.name, "slug": self.slug, "icon": self.icon}


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

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        return {
            "place_id": self.place_id,
            "name": self.name,
            "lat": float(self.lat),
            "lng": float(self.lng),
            "categories": [cat.to_dict() for cat in self.categories],
            "address": self.address,
            "city": self.city,
            "weburl": self.weburl,
            "source": self.source,
            "last_updated": self.last_updated,
        }

    @property
    def category_slugs(self) -> list[str]:
        """Get list of category slugs."""
        return [cat.slug for cat in self.categories]

    @property
    def category_names(self) -> list[str]:
        """Get list of category names."""
        return [cat.name for cat in self.categories]


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


def get_category_display(slug: str) -> dict:
    """Get display name and icon for a category slug."""
    return PLACE_CATEGORIES.get(slug, {"name": slug.replace("-", " ").title(), "icon": "📍"})
