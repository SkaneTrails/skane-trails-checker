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
    source: str  # "skaneleden" | "other_trails" | "world_wide_hikes"
    last_updated: str  # ISO 8601 timestamp

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        data = asdict(self)
        # Convert bounds and center to nested dicts
        data["bounds"] = asdict(self.bounds)
        data["center"] = asdict(self.center)
        return data

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
            coordinates_map=[tuple(coord) for coord in data["coordinates_map"]],
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
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "TrailDetails":
        """Create TrailDetails from Firestore document data."""
        return cls(
            trail_id=data["trail_id"],
            coordinates_full=[tuple(coord) for coord in data["coordinates_full"]],
            elevation_profile=data.get("elevation_profile"),
            waypoints=data.get("waypoints"),
            statistics=data.get("statistics"),
        )
