"""Data models for places (POIs) stored in Firestore."""

from dataclasses import dataclass, field


@dataclass
class PlaceCategory:
    """Category information for a place."""

    name: str
    slug: str
    icon: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        return {"name": self.name, "slug": self.slug, "icon": self.icon}

    @classmethod
    def from_dict(cls, data: dict) -> "PlaceCategory":
        """Create PlaceCategory from dictionary."""
        return cls(name=data.get("name", ""), slug=data.get("slug", ""), icon=data.get("icon", ""))


@dataclass
class Place:
    """Place/POI data from Skåneleden.

    This is stored in the 'places' collection and loaded for map display.
    """

    place_id: str
    name: str
    lat: float
    lng: float
    categories: list[PlaceCategory] = field(default_factory=list)
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

    @classmethod
    def from_dict(cls, data: dict) -> "Place":
        """Create Place from Firestore document data."""
        categories = [PlaceCategory.from_dict(cat) for cat in data.get("categories", [])]

        return cls(
            place_id=data["place_id"],
            name=data["name"],
            lat=data["lat"],
            lng=data["lng"],
            categories=categories,
            address=data.get("address", ""),
            city=data.get("city", ""),
            weburl=data.get("weburl", ""),
            source=data.get("source", "skaneleden"),
            last_updated=data.get("last_updated", ""),
        )

    @property
    def category_slugs(self) -> list[str]:
        """Get list of category slugs."""
        return [cat.slug for cat in self.categories]

    @property
    def category_names(self) -> list[str]:
        """Get list of category names."""
        return [cat.name for cat in self.categories]


# Category display mapping with emojis
PLACE_CATEGORIES = {
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
