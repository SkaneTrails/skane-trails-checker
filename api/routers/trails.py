"""Trail API endpoints."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from api.models.trail import TrailDetailsResponse, TrailResponse, TrailUpdate
from api.storage import trail_storage

router = APIRouter(prefix="/trails", tags=["trails"])


@router.get("")
def list_trails(
    source: Annotated[
        str | None, Query(description="Filter by source: planned_hikes, other_trails, world_wide_hikes")
    ] = None,
    search: Annotated[str | None, Query(description="Search trail names (case-insensitive)")] = None,
    min_distance_km: Annotated[float | None, Query(ge=0, description="Minimum distance in km")] = None,
    max_distance_km: Annotated[float | None, Query(ge=0, description="Maximum distance in km")] = None,
    status: Annotated[str | None, Query(pattern=r"^(To Explore|Explored!)$", description="Filter by status")] = None,
) -> list[TrailResponse]:
    """List all trails with optional filtering."""
    trails = trail_storage.get_all_trails(source=source)

    if search:
        query_lower = search.lower()
        trails = [t for t in trails if query_lower in t.name.lower()]

    if min_distance_km is not None:
        trails = [t for t in trails if t.length_km >= min_distance_km]

    if max_distance_km is not None:
        trails = [t for t in trails if t.length_km <= max_distance_km]

    if status:
        trails = [t for t in trails if t.status == status]

    return trails


@router.get("/{trail_id}")
def get_trail(trail_id: str) -> TrailResponse:
    """Get a single trail by ID."""
    trail = trail_storage.get_trail(trail_id)
    if not trail:
        raise HTTPException(status_code=404, detail="Trail not found")
    return trail


@router.get("/{trail_id}/details")
def get_trail_details(trail_id: str) -> TrailDetailsResponse:
    """Get detailed trail data (full coordinates, elevation profile)."""
    details = trail_storage.get_trail_details(trail_id)
    if not details:
        raise HTTPException(status_code=404, detail="Trail details not found")
    return details


@router.patch("/{trail_id}")
def update_trail(trail_id: str, body: TrailUpdate) -> TrailResponse:
    """Update trail fields (name, status, difficulty)."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    trail_storage.update_trail(trail_id, updates)

    updated = trail_storage.get_trail(trail_id)
    if not updated:  # pragma: no cover
        raise HTTPException(status_code=404, detail="Trail not found after update")
    return updated


@router.delete("/{trail_id}", status_code=204)
def delete_trail(trail_id: str) -> None:
    """Delete a trail and its details."""
    existing = trail_storage.get_trail(trail_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Trail not found")

    trail_storage.delete_trail(trail_id)
