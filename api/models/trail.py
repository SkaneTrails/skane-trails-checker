"""Pydantic models for trail API endpoints."""

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    """A geographic coordinate point."""

    lat: float
    lng: float


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

    def to_dict(self) -> dict:
        """Convert to dictionary for Firestore storage."""
        data = {
            "trail_id": self.trail_id,
            "name": self.name,
            "difficulty": self.difficulty,
            "length_km": float(self.length_km),
            "status": self.status,
            "coordinates_map": [{"lat": float(c.lat), "lng": float(c.lng)} for c in self.coordinates_map],
            "bounds": {
                "north": float(self.bounds.north),
                "south": float(self.bounds.south),
                "east": float(self.bounds.east),
                "west": float(self.bounds.west),
            },
            "center": {"lat": float(self.center.lat), "lng": float(self.center.lng)},
            "source": self.source,
            "last_updated": self.last_updated,
        }
        if self.activity_date is not None:
            data["activity_date"] = self.activity_date
        if self.activity_type is not None:
            data["activity_type"] = self.activity_type
        if self.created_at is not None:
            data["created_at"] = self.created_at
        if self.modified_at is not None:
            data["modified_at"] = self.modified_at
        if self.elevation_gain is not None:
            data["elevation_gain"] = float(self.elevation_gain)
        if self.elevation_loss is not None:
            data["elevation_loss"] = float(self.elevation_loss)
        return data


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
            "coordinates_full": [{"lat": float(c.lat), "lng": float(c.lng)} for c in self.coordinates_full],
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
    difficulty: str | None = None


class TrailFilterParams(BaseModel):
    """Query parameters for filtering trails."""

    source: str | None = None
    search: str | None = None
    min_distance_km: float | None = None
    max_distance_km: float | None = None
    status: str | None = Field(default=None, pattern=r"^(To Explore|Explored!)$")
    since: str | None = None


class SyncMetadata(BaseModel):
    """Sync metadata for delta trail fetching."""

    count: int = Field(description="Total number of trails")
    last_modified: str | None = Field(
        default=None, description="ISO timestamp of last trail create/update/delete (Z-suffix UTC)"
    )
