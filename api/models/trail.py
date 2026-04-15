"""Pydantic models for trail API endpoints."""

from pydantic import BaseModel, Field, field_validator

TRAIL_COLORS: frozenset[str] = frozenset(
    {
        "#E53E3E",  # Red
        "#4169E1",  # Blue
        "#ECC94B",  # Yellow
        "#38A169",  # Green
        "#FF8000",  # Orange
        "#805AD5",  # Purple
        "#63B3ED",  # Light Blue
        "#ED64A6",  # Pink
        "#FFFFFF",  # White
        "#1A1A1A",  # Black
    }
)


class Coordinate(BaseModel):
    """A geographic coordinate point."""

    lat: float
    lng: float
    elevation: float | None = None


class TrailBounds(BaseModel):
    """Geographic bounding box for a trail."""

    north: float
    south: float
    east: float
    west: float


class TrailResponse(BaseModel):
    """Trail data returned by the API (map display)."""

    trail_id: str
    name: str
    difficulty: str
    length_km: float
    status: str = Field(description="'To Explore' or 'Explored!'")
    coordinates_map: list[Coordinate]
    bounds: TrailBounds
    center: Coordinate
    source: str = Field(description="'planned_hikes', 'other_trails', or 'world_wide_hikes'")
    last_updated: str
    created_at: str | None = None
    modified_at: str | None = None
    activity_date: str | None = None
    activity_type: str | None = None
    elevation_gain: float | None = None
    elevation_loss: float | None = None
    duration_minutes: int | None = None
    avg_inclination_deg: float | None = None
    max_inclination_deg: float | None = None
    created_by: str | None = Field(default=None, exclude=True)
    group_id: str | None = None
    line_color: str | None = None
    is_public: bool = False

    @field_validator("line_color")
    @classmethod
    def validate_line_color(cls, v: str | None) -> str | None:
        if v is not None and v not in TRAIL_COLORS:
            msg = f"Invalid color '{v}'. Must be one of: {sorted(TRAIL_COLORS)}"
            raise ValueError(msg)
        return v

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        data = {
            "trail_id": self.trail_id,
            "name": self.name,
            "difficulty": self.difficulty,
            "length_km": float(self.length_km),
            "status": self.status,
            "coordinates_map": [
                {
                    "lat": float(c.lat),
                    "lng": float(c.lng),
                    **({"elevation": float(c.elevation)} if c.elevation is not None else {}),
                }
                for c in self.coordinates_map
            ],
            "bounds": {
                "north": float(self.bounds.north),
                "south": float(self.bounds.south),
                "east": float(self.bounds.east),
                "west": float(self.bounds.west),
            },
            "center": {"lat": float(self.center.lat), "lng": float(self.center.lng)},
            "source": self.source,
            "group_id": self.group_id,
            "is_public": self.is_public,
            "last_updated": self.last_updated,
        }
        self._add_optional_fields(data)
        return data

    def _add_optional_fields(self, data: dict) -> None:
        """Add optional fields to the dictionary if they are set."""
        optional_str = {
            "activity_date": self.activity_date,
            "activity_type": self.activity_type,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
            "created_by": self.created_by,
            "line_color": self.line_color,
        }
        data.update({k: v for k, v in optional_str.items() if v is not None})

        optional_float = {
            "elevation_gain": self.elevation_gain,
            "elevation_loss": self.elevation_loss,
            "avg_inclination_deg": self.avg_inclination_deg,
            "max_inclination_deg": self.max_inclination_deg,
        }
        data.update({k: float(v) for k, v in optional_float.items() if v is not None})

        if self.duration_minutes is not None:
            data["duration_minutes"] = self.duration_minutes


class TrailDetailsResponse(BaseModel):
    """Detailed trail data for single trail view."""

    trail_id: str
    coordinates_full: list[Coordinate]
    elevation_profile: list[float] | None = None
    waypoints: list[dict] | None = None
    statistics: dict | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        data = {
            "trail_id": self.trail_id,
            "coordinates_full": [
                {
                    "lat": float(c.lat),
                    "lng": float(c.lng),
                    **({"elevation": float(c.elevation)} if c.elevation is not None else {}),
                }
                for c in self.coordinates_full
            ],
        }
        if self.elevation_profile is not None:
            data["elevation_profile"] = [float(x) for x in self.elevation_profile]
        if self.waypoints is not None:
            data["waypoints"] = self.waypoints
        if self.statistics is not None:
            data["statistics"] = self.statistics
        return data


class TrailStatusUpdate(BaseModel):
    """Request body for updating trail status."""

    status: str = Field(description="'To Explore' or 'Explored!'", pattern=r"^(To Explore|Explored!)$")


class TrailNameUpdate(BaseModel):
    """Request body for updating trail name."""

    name: str = Field(min_length=1, max_length=200)


class TrailUpdate(BaseModel):
    """Request body for updating multiple trail fields."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, pattern=r"^(To Explore|Explored!)$")
    difficulty: str | None = Field(default=None, max_length=50)
    activity_date: str | None = Field(default=None, max_length=50)
    activity_type: str | None = Field(default=None, max_length=100)
    line_color: str | None = None
    is_public: bool | None = None

    @field_validator("line_color")
    @classmethod
    def validate_line_color(cls, v: str | None) -> str | None:
        if v is not None and v not in TRAIL_COLORS:
            msg = f"Invalid color '{v}'. Must be one of: {sorted(TRAIL_COLORS)}"
            raise ValueError(msg)
        return v


class TrailFilterParams(BaseModel):
    """Query parameters for filtering trails."""

    source: str | None = Field(default=None, max_length=50)
    search: str | None = Field(default=None, max_length=200)
    min_distance_km: float | None = None
    max_distance_km: float | None = None
    status: str | None = Field(default=None, pattern=r"^(To Explore|Explored!)$")
    since: str | None = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$",
        description="ISO timestamp (e.g. 2024-01-01T12:34:56Z or 2024-01-01T12:34:56.789Z) for modified_at filtering",
    )


class SyncMetadata(BaseModel):
    """Sync metadata for delta trail fetching."""

    count: int = Field(description="Total number of trails")
    last_modified: str | None = Field(
        default=None, description="ISO timestamp of last trail create/update/delete (Z-suffix UTC)"
    )


class RecordingCoordinate(BaseModel):
    """A GPS coordinate from a device recording."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    altitude: float | None = None
    timestamp: int = Field(description="Unix timestamp in milliseconds")


class RecordingCreate(BaseModel):
    """Request body for saving a GPS recording as a trail."""

    name: str = Field(min_length=1, max_length=200)
    coordinates: list[RecordingCoordinate] = Field(min_length=2, max_length=10_000)
