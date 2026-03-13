"""Pydantic models for hike group API endpoints."""

from pydantic import BaseModel, Field

MAX_GROUP_NAME_LENGTH = 50
MAX_MEMBERS = 20
MAX_EMAIL_LENGTH = 200


class HikeGroupMember(BaseModel):
    """A member of a hike group."""

    uid: str = ""
    email: str
    name: str | None = None
    role: str = Field(default="member", pattern=r"^(owner|member)$")


class HikeGroupResponse(BaseModel):
    """Hike group data returned by the API."""

    group_id: str
    name: str
    members: list[HikeGroupMember]
    created_by: str = Field(exclude=True)
    created_at: str = ""
    last_updated: str = ""


class HikeGroupCreate(BaseModel):
    """Request body for creating a hike group."""

    name: str = Field(min_length=1, max_length=MAX_GROUP_NAME_LENGTH)


class HikeGroupUpdate(BaseModel):
    """Request body for updating a hike group."""

    name: str | None = Field(default=None, min_length=1, max_length=MAX_GROUP_NAME_LENGTH)


class AddMemberRequest(BaseModel):
    """Request body for adding a member to a hike group."""

    email: str = Field(min_length=1, max_length=MAX_EMAIL_LENGTH)
