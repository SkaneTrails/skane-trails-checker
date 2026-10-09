"""Places/POI API endpoints.

Imported places are public. A place added in the app is private to its group.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from api.auth import AuthenticatedUser, require_auth
from api.models.place import PLACE_CATEGORIES, PlaceResponse
from api.storage import places_storage

router = APIRouter(prefix="/places", tags=["places"])


@router.get("")
def list_places(
    user: Annotated[AuthenticatedUser, Depends(require_auth)],
    category: Annotated[str | None, Query(description="Filter by category slug", max_length=100)] = None,
) -> list[PlaceResponse]:
    """List public places plus those of the user's group, optionally filtered by category."""
    places = places_storage.get_places_by_category(category) if category else places_storage.get_all_places()
    return [place for place in places if place.is_visible_to(user.group_id)]


@router.get("/categories")
def list_categories() -> dict[str, dict[str, str]]:
    """List all available place categories with display info."""
    return PLACE_CATEGORIES
