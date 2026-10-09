"""Foraging API endpoints.

Group-scoped access, the same for every role (superusers included):
- Spots: any member reads and writes their own group's spots
- Types: global reference data (admin for writes, any auth user for reads)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.auth import AuthenticatedUser, require_auth, require_group
from api.models.foraging import (
    ForagingSpotCreate,
    ForagingSpotResponse,
    ForagingSpotUpdate,
    ForagingTypeCreate,
    ForagingTypeResponse,
    ForagingTypeUpdate,
)
from api.storage import foraging_storage

router = APIRouter(prefix="/foraging", tags=["foraging"])


def _require_admin_role(user: AuthenticatedUser) -> None:
    """Require admin or superuser role."""
    if user.role in ("admin", "superuser"):
        return
    raise HTTPException(status_code=403, detail="Admin access required")


def _require_spot_write_access(user: AuthenticatedUser, spot: ForagingSpotResponse) -> None:
    """Require the spot to belong to the user's group."""
    if spot.group_id is None or spot.group_id != user.group_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this foraging spot")


@router.get("/spots")
def list_foraging_spots(
    user: Annotated[AuthenticatedUser, Depends(require_auth)],
    month: Annotated[str | None, Query(pattern=r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$")] = None,
) -> list[ForagingSpotResponse]:
    """List foraging spots for the user's group, optionally filtered by month.

    When month is provided, returns spots that include that month in their months list.
    """
    group_id = require_group(user)
    return foraging_storage.get_foraging_spots(month=month, group_id=group_id)


@router.post("/spots", status_code=201)
def create_foraging_spot(
    body: ForagingSpotCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> ForagingSpotResponse:
    """Create a new foraging spot in the user's group."""
    spot_data = body.model_dump()
    group_id = require_group(user)
    spot_data["created_by"] = user.uid
    spot_data["group_id"] = group_id
    doc_id = foraging_storage.save_foraging_spot(spot_data)

    created = foraging_storage.get_foraging_spot(doc_id)
    if created:
        return created

    return ForagingSpotResponse(
        id=doc_id, created_by=user.uid, group_id=user.group_id, **body.model_dump()
    )  # pragma: no cover


@router.patch("/spots/{spot_id}", status_code=204)
def update_foraging_spot(
    spot_id: str, body: ForagingSpotUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> None:
    """Update a foraging spot in the user's group."""
    existing = foraging_storage.get_foraging_spot(spot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Foraging spot not found")

    _require_spot_write_access(user, existing)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    foraging_storage.update_foraging_spot(spot_id, updates)


@router.delete("/spots/{spot_id}", status_code=204)
def delete_foraging_spot(spot_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a foraging spot in the user's group."""
    existing = foraging_storage.get_foraging_spot(spot_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Foraging spot not found")

    _require_spot_write_access(user, existing)

    foraging_storage.delete_foraging_spot(spot_id)


@router.get("/types")
def list_foraging_types(_user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[ForagingTypeResponse]:
    """List all foraging types. Any authenticated user."""
    return foraging_storage.get_foraging_types()


@router.post("/types", status_code=201)
def create_foraging_type(
    body: ForagingTypeCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> ForagingTypeResponse:
    """Create or update a foraging type. Admin or superuser only."""
    _require_admin_role(user)

    type_data = body.model_dump(exclude={"name"}, exclude_defaults=True)
    type_data["icon"] = body.icon
    foraging_storage.save_foraging_type(body.name, type_data)
    return ForagingTypeResponse(name=body.name, **body.model_dump(exclude={"name"}))


@router.patch("/types/{type_name}")
def update_foraging_type(
    type_name: str, body: ForagingTypeUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> ForagingTypeResponse:
    """Update a foraging type. Admin or superuser only."""
    _require_admin_role(user)

    existing = foraging_storage.get_foraging_type(type_name)
    if not existing:
        raise HTTPException(status_code=404, detail="Foraging type not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    foraging_storage.update_foraging_type(type_name, updates)

    updated = foraging_storage.get_foraging_type(type_name)
    if updated:
        return updated
    return existing  # pragma: no cover


@router.delete("/types/{type_name}", status_code=204)
def delete_foraging_type(type_name: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a foraging type. Admin or superuser only."""
    _require_admin_role(user)
    foraging_storage.delete_foraging_type(type_name)
