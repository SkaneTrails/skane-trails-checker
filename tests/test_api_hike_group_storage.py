"""Tests for hike group and membership storage operations."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.models.hike_group import HikeGroupResponse
from api.storage.hike_group_storage import (
    GroupMember,
    _normalize_email,
    add_member,
    delete_hike_group,
    get_all_hike_groups,
    get_hike_group,
    get_user_membership,
    group_name_exists,
    is_superuser,
    list_group_members,
    remove_member,
    save_hike_group,
    update_hike_group,
    update_member_role,
)
from api.storage.validation import InvalidDocumentIdError


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    """Mock Firestore collection for hike group storage."""
    with patch("api.storage.hike_group_storage.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _make_doc(doc_id: str, data: dict | None) -> MagicMock:
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = data is not None
    doc.to_dict.return_value = data
    return doc


class TestIsSuperuser:
    def test_returns_true_when_superuser(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = True
        mock_collection.document.return_value.get.return_value = doc
        assert is_superuser("Admin@Example.COM") is True
        mock_collection.document.assert_called_once_with("admin@example.com")

    def test_returns_false_when_not_superuser(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = False
        mock_collection.document.return_value.get.return_value = doc
        assert is_superuser("nobody@example.com") is False


class TestGetHikeGroup:
    def test_returns_group_by_id(self, mock_collection) -> None:
        data = {
            "name": "Hemmestorp",
            "created_by": "su@example.com",
            "created_at": "2026-01-01",
            "last_updated": "2026-01-01",
        }
        mock_collection.document.return_value.get.return_value = _make_doc("g1", data)

        result = get_hike_group("g1")
        assert result is not None
        assert isinstance(result, HikeGroupResponse)
        assert result.group_id == "g1"
        assert result.name == "Hemmestorp"
        mock_collection.document.assert_called_once_with("g1")

    def test_returns_none_when_not_found(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = False
        mock_collection.document.return_value.get.return_value = doc
        assert get_hike_group("nonexistent") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = None
        mock_collection.document.return_value.get.return_value = doc
        assert get_hike_group("bad-doc") is None

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="group_id"):
            get_hike_group("")


class TestGetAllHikeGroups:
    def test_returns_all_groups(self, mock_collection) -> None:
        mock_collection.stream.return_value = [
            _make_doc("g1", {"name": "Group A", "created_by": "su@example.com"}),
            _make_doc("g2", {"name": "Group B", "created_by": "su@example.com"}),
        ]
        result = get_all_hike_groups()
        assert len(result) == 2

    def test_returns_empty(self, mock_collection) -> None:
        mock_collection.stream.return_value = []
        assert get_all_hike_groups() == []

    def test_skips_none_data(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("g1", None)]
        assert get_all_hike_groups() == []


class TestSaveHikeGroup:
    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T10:00:00Z")
    def test_saves_and_returns_id(self, mock_now, mock_collection) -> None:
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "new-id"
        mock_collection.document.return_value = mock_doc_ref

        result = save_hike_group("New Group", "su@example.com")

        assert result == "new-id"
        mock_doc_ref.set.assert_called_once()
        saved = mock_doc_ref.set.call_args[0][0]
        assert saved["name"] == "New Group"
        assert saved["created_by"] == "su@example.com"
        assert saved["created_at"] == "2026-03-13T10:00:00Z"
        assert saved["last_updated"] == "2026-03-13T10:00:00Z"


class TestUpdateHikeGroup:
    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T11:00:00Z")
    def test_updates_with_timestamp(self, mock_now, mock_collection) -> None:
        update_hike_group("g1", {"name": "Renamed"})
        mock_collection.document.assert_called_once_with("g1")
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["name"] == "Renamed"
        assert updated["last_updated"] == "2026-03-13T11:00:00Z"

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="group_id"):
            update_hike_group("", {"name": "Test"})


class TestDeleteHikeGroup:
    def test_deletes_by_id(self, mock_collection) -> None:
        delete_hike_group("g1")
        mock_collection.document.assert_called_once_with("g1")
        mock_collection.document.return_value.delete.assert_called_once()

    def test_rejects_invalid_id(self, mock_collection) -> None:
        with pytest.raises(InvalidDocumentIdError, match="group_id"):
            delete_hike_group("..")


class TestGroupNameExists:
    def test_returns_true_when_exists(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("g1", {"name": "Hemmestorp"})]
        assert group_name_exists("Hemmestorp") is True

    def test_returns_false_when_not_exists(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("g1", {"name": "Other Group"})]
        assert group_name_exists("Hemmestorp") is False

    def test_case_insensitive(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("g1", {"name": "hemmestorp"})]
        assert group_name_exists("HEMMESTORP") is True

    def test_excludes_id(self, mock_collection) -> None:
        mock_collection.stream.return_value = [_make_doc("g1", {"name": "Hemmestorp"})]
        assert group_name_exists("Hemmestorp", exclude_id="g1") is False


class TestGetUserMembership:
    def test_returns_membership(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {
            "group_id": "g1",
            "role": "admin",
            "display_name": "Alice",
            "joined_at": "2026-01-01",
            "invited_by": "su@example.com",
        }
        mock_collection.document.return_value.get.return_value = doc

        result = get_user_membership("Alice@Example.COM")
        assert result is not None
        assert isinstance(result, GroupMember)
        assert result.email == "alice@example.com"
        assert result.group_id == "g1"
        assert result.role == "admin"
        mock_collection.document.assert_called_once_with("alice@example.com")

    def test_returns_none_when_not_member(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = False
        mock_collection.document.return_value.get.return_value = doc
        assert get_user_membership("nobody@example.com") is None

    def test_returns_none_when_data_is_none(self, mock_collection) -> None:
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = None
        mock_collection.document.return_value.get.return_value = doc
        assert get_user_membership("bad@example.com") is None


class TestAddMember:
    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T10:00:00Z")
    def test_adds_member(self, mock_now, mock_collection) -> None:
        add_member("g1", "New@Example.COM", role="member", display_name="New User", invited_by="admin@example.com")
        saved = mock_collection.document.return_value.set.call_args[0][0]
        assert saved["group_id"] == "g1"
        assert saved["role"] == "member"
        assert saved["display_name"] == "New User"
        assert saved["invited_by"] == "admin@example.com"
        assert saved["joined_at"] == "2026-03-13T10:00:00Z"
        mock_collection.document.return_value.update.assert_called_once()


class TestRemoveMember:
    def test_removes_existing_member(self, mock_collection) -> None:
        doc_ref = MagicMock()
        doc_get = MagicMock()
        doc_get.exists = True
        doc_get.to_dict.return_value = {"group_id": "g1", "role": "member"}
        doc_ref.get.return_value = doc_get
        mock_collection.document.return_value = doc_ref

        result = remove_member("user@example.com")
        assert result is True
        doc_ref.delete.assert_called_once()
        doc_ref.update.assert_called_once()

    def test_returns_false_for_nonexistent(self, mock_collection) -> None:
        doc_ref = MagicMock()
        doc_get = MagicMock()
        doc_get.exists = False
        doc_ref.get.return_value = doc_get
        mock_collection.document.return_value = doc_ref

        result = remove_member("nobody@example.com")
        assert result is False
        doc_ref.delete.assert_not_called()


class TestListGroupMembers:
    def test_lists_members(self, mock_collection) -> None:
        docs = [
            _make_doc("user1@example.com", {"group_id": "g1", "role": "admin", "display_name": "User 1"}),
            _make_doc("user2@example.com", {"group_id": "g1", "role": "member"}),
        ]
        mock_collection.where.return_value.stream.return_value = docs

        result = list_group_members("g1")
        assert len(result) == 2
        assert result[0].email == "user1@example.com"
        assert result[0].role == "admin"
        assert result[1].role == "member"
        mock_collection.where.assert_called_once_with("group_id", "==", "g1")

    def test_returns_empty_for_no_members(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = []
        assert list_group_members("g1") == []

    def test_skips_none_data(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [_make_doc("u@x.com", None)]
        assert list_group_members("g1") == []


class TestNormalizeEmail:
    def test_lowercases(self) -> None:
        assert _normalize_email("User@Example.COM") == "user@example.com"


class TestUpdateMemberRole:
    def test_updates_existing_member(self, mock_collection) -> None:
        doc_ref = MagicMock()
        doc_get = MagicMock()
        doc_get.exists = True
        doc_ref.get.return_value = doc_get
        mock_collection.document.return_value = doc_ref

        result = update_member_role("user@example.com", "admin")
        assert result is True
        doc_ref.update.assert_called_once_with({"role": "admin"})

    def test_returns_false_for_nonexistent(self, mock_collection) -> None:
        doc_ref = MagicMock()
        doc_get = MagicMock()
        doc_get.exists = False
        doc_ref.get.return_value = doc_get
        mock_collection.document.return_value = doc_ref

        result = update_member_role("nobody@example.com", "admin")
        assert result is False
        doc_ref.update.assert_not_called()

    def test_strips_whitespace(self) -> None:
        assert _normalize_email("  user@example.com  ") == "user@example.com"

    def test_rejects_forward_slash(self) -> None:
        with pytest.raises(ValueError, match="path separators"):
            _normalize_email("bad/email@example.com")

    def test_rejects_backslash(self) -> None:
        with pytest.raises(ValueError, match="path separators"):
            _normalize_email("bad\\email@example.com")
