"""Models for the sync status endpoint."""

from pydantic import BaseModel, Field


class SyncStatusResponse(BaseModel):
    """Current version of each data type; compare for equality with what was last synced."""

    trails: str | None = Field(default=None, description="Trails (and their coordinates)")
    places: str | None = Field(default=None, description="Places and place categories")
    foraging_spots: str | None = Field(default=None, description="Foraging spots")
    foraging_types: str | None = Field(default=None, description="Foraging types")
    images: str | None = Field(default=None, description="Trail photos and the map photo pins")
