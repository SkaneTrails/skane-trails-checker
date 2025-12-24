"""Data models for trails stored in Firestore."""

from dataclasses import asdict, dataclass


@dataclass
class TrailBounds:
    """Geographic bounds of a trail."""

    north: float
    south: float
    east: float
    west: float


@dataclass
class TrailCenter:
    """Center point of a trail."""

    lat: float
    lng: float


@dataclass
class Trail:
    """Lightweight trail data for map display.

    This is stored in the 'trails' collection and loaded for all trails
    when the map page loads. Coordinates are simplified (~50 points).
    """

    trail_id: str
    name: str
    difficulty: str
    length_km: float
    status: str  # "To Explore" | "Explored!"
    coordinates_map: list[tuple[float, float]]  # Simplified coordinates for map
    bounds: TrailBounds
    center: TrailCenter
    source: str  # "planned_hikes" | "other_trails" | "world_wide_hikes"
    last_updated: str  # ISO 8601 timestamp

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        # Convert coordinates to array of objects (not nested arrays - Firestore limitation)
        coords_objects = [{"lat": float(lat), "lng": float(lng)} for lat, lng in self.coordinates_map]
        return {
            "trail_id": self.trail_id,
            "name": self.name,
            "difficulty": self.difficulty,
            "length_km": float(self.length_km),
            "status": self.status,
            "coordinates_map": coords_objects,
            "bounds": {
                "north": float(self.bounds.north),
                "south": float(self.bounds.south),
                "east": float(self.bounds.east),
                "west": float(self.bounds.west),
            },
            "center": {
                "lat": float(self.center.lat),
                "lng": float(self.center.lng),
            },
            "source": self.source,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Trail":
        """Create Trail from Firestore document data."""
        # Convert nested dicts to dataclasses
        bounds = TrailBounds(**data["bounds"])
        center = TrailCenter(**data["center"])

        return cls(
            trail_id=data["trail_id"],
            name=data["name"],
            difficulty=data["difficulty"],
            length_km=data["length_km"],
            status=data["status"],
            coordinates_map=[(coord["lat"], coord["lng"]) for coord in data["coordinates_map"]],
            bounds=bounds,
            center=center,
            source=data["source"],
            last_updated=data["last_updated"],
        )


@dataclass
class TrailDetails:
    """Detailed trail data for single trail view.

    This is stored in the 'trail_details' collection and loaded only
    when user clicks on a specific trail. Coordinates are more detailed (~200 points).
    """

    trail_id: str
    coordinates_full: list[tuple[float, float]]  # More detailed coordinates
    elevation_profile: list[float] | None = None
    waypoints: list[dict] | None = None
    statistics: dict | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        # Convert coordinates to array of objects (not nested arrays - Firestore limitation)
        data = {
            "trail_id": self.trail_id,
            "coordinates_full": [{"lat": float(lat), "lng": float(lng)} for lat, lng in self.coordinates_full],
        }
        if self.elevation_profile is not None:
            data["elevation_profile"] = [float(x) for x in self.elevation_profile]
        if self.waypoints is not None:
            data["waypoints"] = self.waypoints
        if self.statistics is not None:
            data["statistics"] = self.statistics
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "TrailDetails":
        """Create TrailDetails from Firestore document data."""
        return cls(
            trail_id=data["trail_id"],
            coordinates_full=[(coord["lat"], coord["lng"]) for coord in data["coordinates_full"]],
            elevation_profile=data.get("elevation_profile"),
            waypoints=data.get("waypoints"),
            statistics=data.get("statistics"),
        )
