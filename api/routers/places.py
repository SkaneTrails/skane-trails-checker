"""Places/POI API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Query

from api.models.place import PLACE_CATEGORIES, PlaceResponse
from api.storage import places_storage

router = APIRouter(prefix="/places", tags=["places"])


@router.get("")
def list_places(
    category: Annotated[str | None, Query(description="Filter by category slug")] = None,
) -> list[PlaceResponse]:
    """List all places, optionally filtered by category."""
    if category:
        return places_storage.get_places_by_category(category)
    return places_storage.get_all_places()


@router.get("/categories")
def list_categories() -> dict[str, dict[str, str]]:
    """List all available place categories with display info."""
    return PLACE_CATEGORIES
