"""Firestore storage operations for hike groups."""

import logging
from datetime import UTC, datetime

from api.models.hike_group import HikeGroupMember, HikeGroupResponse
from api.storage.firestore_client import get_collection
from api.storage.validation import validate_document_id

logger = logging.getLogger(__name__)

COLLECTION = "hike_groups"


def _utc_now_z() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _doc_to_hike_group(doc_id: str, data: dict) -> HikeGroupResponse:
    """Convert a Firestore document dict to a HikeGroupResponse model."""
    members_raw = data.get("members", [])
    members = [
        HikeGroupMember(
            uid=m.get("uid", ""), email=m.get("email", ""), name=m.get("name"), role=m.get("role", "member")
        )
        for m in members_raw
    ]

    return HikeGroupResponse(
        group_id=doc_id,
        name=data.get("name", ""),
        members=members,
        created_by=data.get("created_by", ""),
        created_at=data.get("created_at", ""),
        last_updated=data.get("last_updated", ""),
    )


def get_hike_group(group_id: str) -> HikeGroupResponse | None:
    """Get a single hike group by ID."""
    validate_document_id(group_id, field_name="group_id")
    doc = get_collection(COLLECTION).document(group_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return _doc_to_hike_group(doc.id, data) if data else None


def get_user_groups(user_uid: str) -> list[HikeGroupResponse]:
    """Get all hike groups where the user is a member."""
    collection = get_collection(COLLECTION)
    docs = collection.where("member_uids", "array_contains", user_uid).stream()
    return [_doc_to_hike_group(doc.id, doc.to_dict()) for doc in docs if doc.to_dict()]


def save_hike_group(group_data: dict) -> str:
    """Save a new hike group. Returns the document ID."""
    collection = get_collection(COLLECTION)
    now = _utc_now_z()
    group_data["created_at"] = now
    group_data["last_updated"] = now
    group_data["member_uids"] = [m["uid"] for m in group_data.get("members", []) if m.get("uid")]

    doc_ref = collection.document()
    doc_ref.set(group_data)
    return doc_ref.id


def update_hike_group(group_id: str, updates: dict) -> None:
    """Update a hike group."""
    validate_document_id(group_id, field_name="group_id")
    if "members" in updates:
        updates["member_uids"] = [m["uid"] for m in updates["members"] if m.get("uid")]
    updates["last_updated"] = _utc_now_z()
    get_collection(COLLECTION).document(group_id).update(updates)


def delete_hike_group(group_id: str) -> None:
    """Delete a hike group."""
    validate_document_id(group_id, field_name="group_id")
    get_collection(COLLECTION).document(group_id).delete()
