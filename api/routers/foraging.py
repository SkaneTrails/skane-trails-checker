"""Foraging API endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

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
def create_foraging_spot(body: ForagingSpotCreate) -> ForagingSpotResponse:
    """Create a new foraging spot."""
    spot_data = body.model_dump()
    doc_id = foraging_storage.save_foraging_spot(spot_data)

    spots = foraging_storage.get_foraging_spots()
    for spot in spots:
        if spot.id == doc_id:
            return spot

    return ForagingSpotResponse(id=doc_id, **body.model_dump())


@router.patch("/spots/{spot_id}", status_code=204)
def update_foraging_spot(spot_id: str, body: ForagingSpotUpdate) -> None:
    """Update a foraging spot."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    foraging_storage.update_foraging_spot(spot_id, updates)


@router.delete("/spots/{spot_id}", status_code=204)
def delete_foraging_spot(spot_id: str) -> None:
    """Delete a foraging spot."""
    foraging_storage.delete_foraging_spot(spot_id)


@router.get("/types")
def list_foraging_types() -> list[ForagingTypeResponse]:
    """List all foraging types."""
    return foraging_storage.get_foraging_types()


@router.post("/types", status_code=201)
def create_foraging_type(body: ForagingTypeCreate) -> ForagingTypeResponse:
    """Create or update a foraging type."""
    type_data = body.model_dump(exclude={"name"}, exclude_defaults=True)
    type_data["icon"] = body.icon
    foraging_storage.save_foraging_type(body.name, type_data)
    return ForagingTypeResponse(name=body.name, **body.model_dump(exclude={"name"}))


@router.delete("/types/{type_name}", status_code=204)
def delete_foraging_type(type_name: str) -> None:
    """Delete a foraging type."""
    foraging_storage.delete_foraging_type(type_name)
