"""Firestore storage operations for hike groups and membership.

Uses flat collections (matching meal-planner pattern):
- hike_groups: group metadata (name, timestamps)
- group_members: one doc per user (email as doc ID, O(1) lookup)
- superusers: global admin emails (email as doc ID)
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from api.models.hike_group import HikeGroupResponse
from api.storage.firestore_client import get_collection
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)

GROUPS_COLLECTION = "hike_groups"
MEMBERS_COLLECTION = "group_members"
SUPERUSERS_COLLECTION = "superusers"


@dataclass
class GroupMember:
    """Internal representation of a group membership."""

    email: str
    group_id: str
    role: str
    display_name: str | None = None
    joined_at: str | None = None
    invited_by: str | None = None


def _utc_now_z() -> str:  # pragma: no cover
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _doc_to_hike_group(doc_id: str, data: dict) -> HikeGroupResponse:
    """Convert a Firestore document dict to a HikeGroupResponse model."""
    return HikeGroupResponse(
        group_id=doc_id,
        name=data.get("name", ""),
        created_by=data.get("created_by", ""),
        created_at=data.get("created_at", ""),
        last_updated=data.get("last_updated", ""),
    )


# --- Superuser operations ---


def is_superuser(email: str) -> bool:
    """Check if user is a superuser (has global access)."""
    normalized_email = email.lower()
    doc = get_collection(SUPERUSERS_COLLECTION).document(normalized_email).get()
    return doc.exists


# --- Group operations ---


def get_hike_group(group_id: str) -> HikeGroupResponse | None:
    """Get a single hike group by ID."""
    validate_document_id(group_id, field_name="group_id")
    doc = get_collection(GROUPS_COLLECTION).document(group_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return _doc_to_hike_group(doc.id, data) if data else None


def get_all_hike_groups() -> list[HikeGroupResponse]:
    """Get all hike groups. For superuser admin view."""
    groups = []
    for doc in get_collection(GROUPS_COLLECTION).stream():
        data = doc.to_dict()
        if data:
            groups.append(_doc_to_hike_group(doc.id, data))
    return groups


def save_hike_group(name: str, created_by: str) -> str:
    """Create a new hike group. Returns the document ID."""
    collection = get_collection(GROUPS_COLLECTION)
    now = _utc_now_z()
    doc_ref = collection.document()
    doc_ref.set({"name": name, "created_by": created_by, "created_at": now, "last_updated": now})
    return doc_ref.id


def update_hike_group(group_id: str, updates: dict) -> None:
    """Update a hike group."""
    validate_document_id(group_id, field_name="group_id")
    updates["last_updated"] = _utc_now_z()
    get_collection(GROUPS_COLLECTION).document(group_id).update(updates)


def delete_hike_group(group_id: str) -> None:
    """Delete a hike group."""
    validate_document_id(group_id, field_name="group_id")
    get_collection(GROUPS_COLLECTION).document(group_id).delete()


def group_name_exists(name: str, *, exclude_id: str | None = None) -> bool:
    """Check if a group with the given name already exists."""
    normalized = name.strip().lower()
    for doc in get_collection(GROUPS_COLLECTION).stream():
        data = doc.to_dict()
        if data and data.get("name", "").strip().lower() == normalized:
            if exclude_id and doc.id == exclude_id:
                continue
            return True
    return False


# --- Membership operations ---


def get_user_membership(email: str) -> GroupMember | None:
    """Get user's group membership. Returns None if not a member of any group."""
    normalized_email = email.lower()
    doc = get_collection(MEMBERS_COLLECTION).document(normalized_email).get()

    if not doc.exists:
        return None

    data = doc.to_dict()
    if data is None:
        return None
    return GroupMember(
        email=normalized_email,
        group_id=data.get("group_id", ""),
        role=data.get("role", "member"),
        display_name=data.get("display_name"),
        joined_at=data.get("joined_at"),
        invited_by=data.get("invited_by"),
    )


def add_member(
    group_id: str, email: str, role: str = "member", display_name: str | None = None, invited_by: str | None = None
) -> None:
    """Add a user to a group. Uses email (lowercased) as document ID for O(1) lookup."""
    normalized_email = email.lower()
    now = _utc_now_z()
    get_collection(MEMBERS_COLLECTION).document(normalized_email).set(
        {"group_id": group_id, "role": role, "display_name": display_name, "joined_at": now, "invited_by": invited_by}
    )


def remove_member(email: str) -> bool:
    """Remove a user from their group. Returns True if member existed and was removed."""
    normalized_email = email.lower()
    doc_ref = get_collection(MEMBERS_COLLECTION).document(normalized_email)

    if not doc_ref.get().exists:
        return False

    doc_ref.delete()
    return True


def list_group_members(group_id: str) -> list[GroupMember]:
    """Get all members of a group."""
    query = get_collection(MEMBERS_COLLECTION).where("group_id", "==", group_id)
    members = []
    for doc in query.stream():
        data = doc.to_dict()
        if data:
            members.append(
                GroupMember(
                    email=doc.id,
                    group_id=group_id,
                    role=data.get("role", "member"),
                    display_name=data.get("display_name"),
                    joined_at=data.get("joined_at"),
                    invited_by=data.get("invited_by"),
                )
            )
    return members
