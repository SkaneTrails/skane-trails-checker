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
    activity_date: str | None = None
    activity_type: str | None = None
    elevation_gain: float | None = None
    elevation_loss: float | None = None


class TrailDetailsResponse(BaseModel):
    """Detailed trail data for single trail view."""

    trail_id: str
    coordinates_full: list[Coordinate]
    elevation_profile: list[float] | None = None
    waypoints: list[dict] | None = None
    statistics: dict | None = None


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
