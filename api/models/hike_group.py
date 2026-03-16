"""Pydantic models for hike group and admin API endpoints."""

from pydantic import BaseModel, Field

MAX_GROUP_NAME_LENGTH = 50
MAX_EMAIL_LENGTH = 200


class HikeGroupResponse(BaseModel):
    """Hike group data returned by the API."""

    group_id: str
    name: str
    created_by: str
    created_at: str = ""
    last_updated: str = ""


class HikeGroupCreate(BaseModel):
    """Request body for creating a hike group."""

    name: str = Field(min_length=1, max_length=MAX_GROUP_NAME_LENGTH)


class HikeGroupUpdate(BaseModel):
    """Request body for updating a hike group."""

    name: str | None = Field(default=None, min_length=1, max_length=MAX_GROUP_NAME_LENGTH)


class MemberResponse(BaseModel):
    """Group member data returned by the API."""

    email: str
    group_id: str
    role: str
    display_name: str | None = None


class MemberAdd(BaseModel):
    """Request body for adding a member to a group."""

    email: str = Field(min_length=1, max_length=MAX_EMAIL_LENGTH)
    role: str = Field(default="member", pattern=r"^(admin|member)$")
    display_name: str | None = None


class CurrentUserResponse(BaseModel):
    """Current user info returned by GET /admin/me."""

    uid: str
    email: str
    role: str
    group_id: str | None = None
    group_name: str | None = None
