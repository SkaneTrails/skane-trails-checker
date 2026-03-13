"""Hike group API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from api.auth import AuthenticatedUser, require_auth
from api.models.hike_group import MAX_MEMBERS, AddMemberRequest, HikeGroupCreate, HikeGroupResponse, HikeGroupUpdate
from api.storage import hike_group_storage

router = APIRouter(prefix="/hike-groups", tags=["hike-groups"])


def _require_owner(group: HikeGroupResponse, user: AuthenticatedUser) -> None:
    """Raise 403 if user is not the group owner."""
    if group.created_by != user.uid:
        raise HTTPException(status_code=403, detail="Only the group owner can perform this action")


def _require_member(group: HikeGroupResponse, user: AuthenticatedUser) -> None:
    """Raise 403 if user is not a member of the group."""
    if not any(m.uid == user.uid for m in group.members):
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _get_group_or_404(group_id: str) -> HikeGroupResponse:
    """Get a hike group or raise 404."""
    group = hike_group_storage.get_hike_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Hike group not found")
    return group


@router.get("")
def list_hike_groups(user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[HikeGroupResponse]:
    """List all hike groups the authenticated user belongs to."""
    return hike_group_storage.get_user_groups(user.uid)


@router.post("", status_code=201)
def create_hike_group(
    body: HikeGroupCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> HikeGroupResponse:
    """Create a new hike group. The creator becomes the owner."""
    owner_member = {"uid": user.uid, "email": user.email, "name": user.name, "role": "owner"}
    group_data = {"name": body.name, "members": [owner_member], "created_by": user.uid}

    doc_id = hike_group_storage.save_hike_group(group_data)

    created = hike_group_storage.get_hike_group(doc_id)
    if created:
        return created

    return HikeGroupResponse(group_id=doc_id, name=body.name, members=[], created_by=user.uid)


@router.get("/{group_id}")
def get_hike_group(group_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> HikeGroupResponse:
    """Get a hike group by ID. Must be a member."""
    group = _get_group_or_404(group_id)
    _require_member(group, user)
    return group


@router.patch("/{group_id}")
def update_hike_group(
    group_id: str, body: HikeGroupUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> HikeGroupResponse:
    """Update a hike group. Owner only."""
    group = _get_group_or_404(group_id)
    _require_owner(group, user)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    hike_group_storage.update_hike_group(group_id, updates)

    updated = hike_group_storage.get_hike_group(group_id)
    if updated:
        return updated
    return group


@router.delete("/{group_id}", status_code=204)
def delete_hike_group(group_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a hike group. Owner only."""
    group = _get_group_or_404(group_id)
    _require_owner(group, user)
    hike_group_storage.delete_hike_group(group_id)


@router.post("/{group_id}/members", status_code=201)
def add_member(
    group_id: str, body: AddMemberRequest, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> HikeGroupResponse:
    """Add a member to a hike group by email. Owner only."""
    group = _get_group_or_404(group_id)
    _require_owner(group, user)

    if len(group.members) >= MAX_MEMBERS:
        raise HTTPException(status_code=400, detail=f"Group cannot exceed {MAX_MEMBERS} members")

    normalized_email = body.email.strip().lower()
    if any(m.email.lower() == normalized_email for m in group.members):
        raise HTTPException(status_code=409, detail="User is already a member of this group")

    new_member = {"uid": "", "email": normalized_email, "name": None, "role": "member"}
    members = [m.model_dump() for m in group.members]
    members.append(new_member)

    hike_group_storage.update_hike_group(group_id, {"members": members})

    updated = hike_group_storage.get_hike_group(group_id)
    if updated:
        return updated
    return group


@router.delete("/{group_id}/members/{member_uid}", status_code=204)
def remove_member(group_id: str, member_uid: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Remove a member from a hike group. Owner only, cannot remove owner."""
    group = _get_group_or_404(group_id)
    _require_owner(group, user)

    if member_uid == user.uid:
        raise HTTPException(status_code=400, detail="Cannot remove the group owner")

    if not any(m.uid == member_uid for m in group.members):
        raise HTTPException(status_code=404, detail="Member not found in group")

    members = [m.model_dump() for m in group.members if m.uid != member_uid]
    hike_group_storage.update_hike_group(group_id, {"members": members})
