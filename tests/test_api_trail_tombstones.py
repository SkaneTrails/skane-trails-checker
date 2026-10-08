"""Tests for trail deletion tombstones (delta sync of deletions)."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.storage.trail_tombstones import get_deleted_trail_ids, record_tombstone


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    with patch("api.storage.trail_tombstones.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _doc(data: dict) -> MagicMock:
    doc = MagicMock()
    doc.to_dict.return_value = data
    return doc


class TestRecordTombstone:
    def test_writes_tombstone_with_group_and_visibility(self, mock_collection) -> None:
        record_tombstone("t1", {"group_id": "g1", "is_public": True}, "2026-03-01T12:00:00Z")

        mock_collection.document.assert_called_once_with("t1")
        mock_collection.document.return_value.set.assert_called_once_with(
            {"trail_id": "t1", "group_id": "g1", "is_public": True, "deleted_at": "2026-03-01T12:00:00Z"}
        )

    def test_defaults_when_trail_has_no_group(self, mock_collection) -> None:
        record_tombstone("t1", {}, "2026-03-01T12:00:00Z")

        written = mock_collection.document.return_value.set.call_args.args[0]
        assert written["group_id"] is None
        assert written["is_public"] is False


class TestGetDeletedTrailIds:
    def test_without_since_returns_nothing_and_reads_nothing(self, mock_collection) -> None:
        assert get_deleted_trail_ids(None, group_id="g1") == []
        mock_collection.where.assert_not_called()

    def test_queries_deletions_since_timestamp(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = []

        get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id="g1")

        mock_collection.where.assert_called_once_with("deleted_at", ">=", "2026-03-01T00:00:00Z")

    def test_group_user_sees_own_public_and_flagged_public_deletions(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _doc({"trail_id": "own", "group_id": "g1", "is_public": False}),
            _doc({"trail_id": "bootstrapped", "group_id": None, "is_public": False}),
            _doc({"trail_id": "shared", "group_id": "g2", "is_public": True}),
            _doc({"trail_id": "other", "group_id": "g2", "is_public": False}),
        ]

        result = get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id="g1")

        assert result == ["own", "bootstrapped", "shared"]

    def test_superuser_sees_every_deletion(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _doc({"trail_id": "a", "group_id": "g1"}),
            _doc({"trail_id": "b", "group_id": "g2"}),
        ]

        assert get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id=None) == ["a", "b"]

    def test_skips_empty_documents(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [_doc({})]

        assert get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id=None) == []
