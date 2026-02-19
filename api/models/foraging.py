"""Pydantic models for foraging API endpoints."""

from pydantic import BaseModel, Field


class ForagingSpotResponse(BaseModel):
    """Foraging spot data returned by the API."""

    id: str
    type: str
    lat: float
    lng: float
    notes: str = ""
    month: str = Field(description="Short month name: Jan, Feb, ..., Dec")
    date: str = ""
    created_at: str = ""
    last_updated: str = ""


class ForagingSpotCreate(BaseModel):
    """Request body for creating a foraging spot."""

    type: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    notes: str = ""
    month: str = Field(min_length=3, max_length=3, pattern=r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$")
    date: str = ""


class ForagingSpotUpdate(BaseModel):
    """Request body for updating a foraging spot."""

    type: str | None = Field(default=None, min_length=1)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = None
    month: str | None = Field(
        default=None, min_length=3, max_length=3, pattern=r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$"
    )
    date: str | None = None


class ForagingTypeResponse(BaseModel):
    """Foraging type data returned by the API."""

    name: str
    icon: str = ""
    color: str = ""


class ForagingTypeCreate(BaseModel):
    """Request body for creating a foraging type."""

    name: str = Field(min_length=1, max_length=100)
    icon: str = Field(min_length=1, max_length=10)
    color: str = ""
