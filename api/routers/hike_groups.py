"""Admin API endpoints for group and member management.

Role-based access control (matching meal-planner pattern):
- Superuser: create/delete groups, manage all members
- Admin: manage members in their own group, rename group
- Member: view only (via GET /admin/me)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from api.auth.firebase import require_auth
from api.auth.models import AuthenticatedUser
from api.models.hike_group import (
    CurrentUserResponse,
    HikeGroupCreate,
    HikeGroupResponse,
    HikeGroupUpdate,
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    SuperuserAdd,
    SuperuserResponse,
)
from api.storage import hike_group_storage

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_superuser(user: AuthenticatedUser) -> None:
    """Require user to be a superuser."""
    if user.role != "superuser":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superuser access required")


def _validate_email_path(email: str) -> str:
    """Validate and normalize an email from a URL path parameter."""
    normalized = email.strip().lower()
    if "/" in normalized or "\\" in normalized:
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def _require_admin_or_superuser(user: AuthenticatedUser, group_id: str) -> None:
    """Require user to be a superuser or admin of the specified group."""
    if user.role == "superuser":
        return
    if user.role == "admin" and user.group_id == group_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or superuser access required")


def _require_member_or_superuser(user: AuthenticatedUser, group_id: str) -> None:
    """Require user to be a superuser or member of the specified group."""
    if user.role == "superuser":
        return
    if user.group_id == group_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Group member or superuser access required")


@router.get("/me")
def get_current_user_info(user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> CurrentUserResponse:
    """Get the current authenticated user's info including group membership."""
    group_name = None
    if user.group_id:
        group = hike_group_storage.get_hike_group(user.group_id)
        if group:
            group_name = group.name

    return CurrentUserResponse(
        uid=user.uid, email=user.email, role=user.role, group_id=user.group_id, group_name=group_name
    )


@router.get("/groups")
def list_groups(user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[HikeGroupResponse]:
    """List all groups. Superuser only."""
    _require_superuser(user)
    return hike_group_storage.get_all_hike_groups()


@router.post("/groups", status_code=201)
def create_group(body: HikeGroupCreate, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> HikeGroupResponse:
    """Create a new hike group. Superuser only."""
    _require_superuser(user)

    if hike_group_storage.group_name_exists(body.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"A group named '{body.name}' already exists")

    doc_id = hike_group_storage.save_hike_group(body.name, user.email)
    created = hike_group_storage.get_hike_group(doc_id)
    if created:
        return created

    return HikeGroupResponse(group_id=doc_id, name=body.name, created_by=user.email)


@router.get("/groups/{group_id}")
def get_group(group_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> HikeGroupResponse:
    """Get a group by ID. Superuser or any group member."""
    _require_member_or_superuser(user, group_id)

    group = hike_group_storage.get_hike_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.patch("/groups/{group_id}")
def update_group(
    group_id: str, body: HikeGroupUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> HikeGroupResponse:
    """Rename a group. Superuser or group admin."""
    _require_admin_or_superuser(user, group_id)

    group = hike_group_storage.get_hike_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "name" in updates and hike_group_storage.group_name_exists(updates["name"], exclude_id=group_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"A group named '{updates['name']}' already exists"
        )

    hike_group_storage.update_hike_group(group_id, updates)

    updated = hike_group_storage.get_hike_group(group_id)
    if updated:
        return updated
    return group  # pragma: no cover


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Delete a group. Superuser only."""
    _require_superuser(user)

    group = hike_group_storage.get_hike_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    hike_group_storage.delete_hike_group(group_id)


@router.get("/groups/{group_id}/members")
def list_members(group_id: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[MemberResponse]:
    """List all members of a group. Superuser or group admin."""
    _require_admin_or_superuser(user, group_id)

    if not hike_group_storage.get_hike_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    members = hike_group_storage.list_group_members(group_id)
    return [
        MemberResponse(email=m.email, group_id=m.group_id, role=m.role, display_name=m.display_name) for m in members
    ]


@router.post("/groups/{group_id}/members", status_code=201)
def add_member(
    group_id: str, body: MemberAdd, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> MemberResponse:
    """Add a member to a group. Superuser or group admin."""
    _require_admin_or_superuser(user, group_id)

    if not hike_group_storage.get_hike_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    existing = hike_group_storage.get_user_membership(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"User {body.email} is already a member of a group"
        )

    if body.role not in ("admin", "member"):  # pragma: no cover
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    hike_group_storage.add_member(
        group_id=group_id, email=body.email, role=body.role, display_name=body.display_name, invited_by=user.email
    )

    return MemberResponse(email=body.email.lower(), group_id=group_id, role=body.role, display_name=body.display_name)


@router.patch("/groups/{group_id}/members/{email:path}")
def update_member_role(
    group_id: str, email: str, body: MemberUpdate, user: Annotated[AuthenticatedUser, Depends(require_auth)]
) -> MemberResponse:
    """Update a member's role. Superuser or group admin."""
    _require_admin_or_superuser(user, group_id)

    normalized_email = _validate_email_path(email)
    user_email = user.email.lower()

    if normalized_email == user_email:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    if not hike_group_storage.get_hike_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    membership = hike_group_storage.get_user_membership(normalized_email)
    if membership is None or membership.group_id != group_id:
        raise HTTPException(status_code=404, detail="Member not found in this group")

    if membership.role == body.role:
        return MemberResponse(
            email=normalized_email, group_id=group_id, role=body.role, display_name=membership.display_name
        )

    if not hike_group_storage.update_member_role(normalized_email, body.role):
        raise HTTPException(status_code=404, detail="Member not found")
    return MemberResponse(
        email=normalized_email, group_id=group_id, role=body.role, display_name=membership.display_name
    )


@router.delete("/groups/{group_id}/members/{email:path}", status_code=204)
def remove_member(group_id: str, email: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Remove a member from a group. Superuser or group admin."""
    _require_admin_or_superuser(user, group_id)

    normalized_email = _validate_email_path(email)
    user_email = user.email.lower()

    if not hike_group_storage.get_hike_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    membership = hike_group_storage.get_user_membership(normalized_email)
    if membership is None or membership.group_id != group_id:
        raise HTTPException(status_code=404, detail="Member not found in this group")

    if normalized_email == user_email:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the group")

    hike_group_storage.remove_member(normalized_email)


# --- Superuser management ---


@router.get("/superusers")
def list_superusers(user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> list[SuperuserResponse]:
    """List all superusers. Superuser only."""
    _require_superuser(user)
    emails = hike_group_storage.list_superusers()
    return [SuperuserResponse(email=e) for e in emails]


@router.post("/superusers", status_code=201)
def add_superuser(body: SuperuserAdd, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> SuperuserResponse:
    """Add a superuser. Superuser only."""
    _require_superuser(user)

    normalized = body.email.strip().lower()
    if hike_group_storage.is_superuser(normalized):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{normalized} is already a superuser")

    hike_group_storage.add_superuser(normalized)
    return SuperuserResponse(email=normalized)


@router.delete("/superusers/{email:path}", status_code=204)
def remove_superuser(email: str, user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> None:
    """Remove a superuser. Superuser only. Cannot remove yourself."""
    _require_superuser(user)

    normalized_email = _validate_email_path(email)
    user_email = user.email.lower()

    if normalized_email == user_email:
        raise HTTPException(status_code=400, detail="Cannot remove yourself as superuser")

    if not hike_group_storage.is_superuser(normalized_email):
        raise HTTPException(status_code=404, detail="Superuser not found")

    hike_group_storage.remove_superuser(normalized_email)
