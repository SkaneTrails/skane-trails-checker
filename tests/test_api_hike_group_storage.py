"""Tests for hike group storage operations."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.models.hike_group import HikeGroupResponse
from api.storage.hike_group_storage import (
    delete_hike_group,
    get_hike_group,
    get_user_groups,
    save_hike_group,
    update_hike_group,
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


class TestGetHikeGroup:
    def test_returns_group_by_id(self, mock_collection) -> None:
        data = {
            "name": "Weekend Hikers",
            "members": [{"uid": "u1", "email": "a@b.com", "name": "Alice", "role": "owner"}],
            "created_by": "u1",
            "created_at": "2026-01-01",
            "last_updated": "2026-01-01",
        }
        mock_collection.document.return_value.get.return_value = _make_doc("g1", data)

        result = get_hike_group("g1")
        assert result is not None
        assert isinstance(result, HikeGroupResponse)
        assert result.group_id == "g1"
        assert result.name == "Weekend Hikers"
        assert len(result.members) == 1
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


class TestGetUserGroups:
    def test_returns_groups_for_user(self, mock_collection) -> None:
        docs = [
            _make_doc("g1", {"name": "Group A", "members": [{"uid": "u1", "email": "a@b.com"}], "created_by": "u1"})
        ]
        mock_collection.where.return_value.stream.return_value = docs

        result = get_user_groups("u1")
        assert len(result) == 1
        assert result[0].group_id == "g1"
        mock_collection.where.assert_called_once_with("member_uids", "array_contains", "u1")

    def test_returns_empty_when_user_in_no_groups(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = []

        result = get_user_groups("u1")
        assert result == []

    def test_skips_docs_with_none_data(self, mock_collection) -> None:
        docs = [_make_doc("g1", None)]
        mock_collection.where.return_value.stream.return_value = docs

        result = get_user_groups("u1")
        assert result == []


class TestSaveHikeGroup:
    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T10:00:00Z")
    def test_saves_and_returns_id(self, mock_now, mock_collection) -> None:
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "new-id"
        mock_collection.document.return_value = mock_doc_ref

        group_data = {"name": "New Group", "members": [], "created_by": "u1"}
        result = save_hike_group(group_data)

        assert result == "new-id"
        mock_doc_ref.set.assert_called_once()
        saved = mock_doc_ref.set.call_args[0][0]
        assert saved["created_at"] == "2026-03-13T10:00:00Z"
        assert saved["last_updated"] == "2026-03-13T10:00:00Z"
        assert saved["member_uids"] == []

    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T10:00:00Z")
    def test_saves_member_uids(self, mock_now, mock_collection) -> None:
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "new-id"
        mock_collection.document.return_value = mock_doc_ref

        group_data = {
            "name": "Group",
            "members": [{"uid": "u1", "email": "a@b.com", "role": "owner"}],
            "created_by": "u1",
        }
        save_hike_group(group_data)

        saved = mock_doc_ref.set.call_args[0][0]
        assert saved["member_uids"] == ["u1"]


class TestUpdateHikeGroup:
    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T11:00:00Z")
    def test_updates_with_timestamp(self, mock_now, mock_collection) -> None:
        update_hike_group("g1", {"name": "Renamed"})
        mock_collection.document.assert_called_once_with("g1")
        mock_collection.document.return_value.update.assert_called_once()
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["name"] == "Renamed"
        assert updated["last_updated"] == "2026-03-13T11:00:00Z"

    @patch("api.storage.hike_group_storage._utc_now_z", return_value="2026-03-13T11:00:00Z")
    def test_updates_member_uids_on_members_change(self, mock_now, mock_collection) -> None:
        members = [{"uid": "u1", "email": "a@b.com", "role": "owner"}, {"email": "new@x.com", "role": "member"}]
        update_hike_group("g1", {"members": members})
        updated = mock_collection.document.return_value.update.call_args[0][0]
        assert updated["member_uids"] == ["u1"]

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
