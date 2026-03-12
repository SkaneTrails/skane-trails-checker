"""Foraging API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import AuthenticatedUser, require_auth
from api.models.foraging import (
    ForagingSpotCreate,
    ForagingSpotResponse,
    ForagingSpotUpdate,
    ForagingTypeCreate,
    ForagingTypeResponse,
)
from api.storage import foraging_storage

router = APIRouter(prefix="/foraging", tags=["foraging"])


@router.get("/spots")
def list_foraging_spots(
    month: Annotated[str | None, Query(pattern=r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$")] = None,
) -> list[ForagingSpotResponse]:
    """List foraging spots, optionally filtered by month."""
    return foraging_storage.get_foraging_spots(month=month)


@router.post("/spots", status_code=201)
def create_foraging_spot(
    body: ForagingSpotCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> ForagingSpotResponse:
    """Create a new foraging spot."""
    spot_data = body.model_dump()
    spot_data["created_by"] = user.uid
    doc_id = foraging_storage.save_foraging_spot(spot_data)

    spots = foraging_storage.get_foraging_spots()
    for spot in spots:
        if spot.id == doc_id:
            return spot

    return ForagingSpotResponse(id=doc_id, **body.model_dump())


@router.patch("/spots/{spot_id}", status_code=204)
def update_foraging_spot(
    spot_id: str, body: ForagingSpotUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> None:
    """Update a foraging spot."""
    existing = foraging_storage.get_foraging_spot(spot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Foraging spot not found")

    if existing.created_by and existing.created_by != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to modify this foraging spot")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    foraging_storage.update_foraging_spot(spot_id, updates)


@router.delete("/spots/{spot_id}", status_code=204)
def delete_foraging_spot(spot_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a foraging spot."""
    existing = foraging_storage.get_foraging_spot(spot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Foraging spot not found")

    if existing.created_by and existing.created_by != user.uid:
        raise HTTPException(status_code=403, detail="Not authorized to delete this foraging spot")

    foraging_storage.delete_foraging_spot(spot_id)


@router.get("/types")
def list_foraging_types() -> list[ForagingTypeResponse]:
    """List all foraging types."""
    return foraging_storage.get_foraging_types()


@router.post("/types", status_code=201)
def create_foraging_type(
    body: ForagingTypeCreate, _user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> ForagingTypeResponse:
    """Create or update a foraging type."""
    type_data = body.model_dump(exclude={"name"}, exclude_defaults=True)
    type_data["icon"] = body.icon
    foraging_storage.save_foraging_type(body.name, type_data)
    return ForagingTypeResponse(name=body.name, **body.model_dump(exclude={"name"}))


@router.delete("/types/{type_name}", status_code=204)
def delete_foraging_type(type_name: str, _user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a foraging type."""
    foraging_storage.delete_foraging_type(type_name)
