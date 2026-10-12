"""Tests for trail tombstones (delta sync of deletions and lost visibility)."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.storage.trail_tombstones import add_tombstone, get_deleted_trail_ids


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


class TestAddTombstone:
    def test_adds_tombstone_with_group_and_visibility(self, mock_collection) -> None:
        batch = MagicMock()

        add_tombstone(batch, "t1", {"group_id": "g1", "is_public": True}, "2026-03-01T12:00:00Z")

        mock_collection.document.assert_called_once_with()
        batch.set.assert_called_once_with(
            mock_collection.document.return_value,
            {"trail_id": "t1", "group_id": "g1", "is_public": True, "deleted_at": "2026-03-01T12:00:00Z"},
        )

    def test_defaults_when_trail_has_no_group(self, mock_collection) -> None:
        batch = MagicMock()

        add_tombstone(batch, "t1", {}, "2026-03-01T12:00:00Z")

        written = batch.set.call_args.args[1]
        assert written["group_id"] is None
        assert written["is_public"] is False

    def test_does_not_write_on_its_own(self, mock_collection) -> None:
        add_tombstone(MagicMock(), "t1", {}, "2026-03-01T12:00:00Z")

        mock_collection.document.return_value.set.assert_not_called()

    def test_every_removal_gets_its_own_document(self, mock_collection) -> None:
        """A later removal of a re-used trail ID must not overwrite the earlier audience."""
        batch = MagicMock()

        add_tombstone(batch, "t1", {"group_id": None, "is_public": True}, "2026-03-01T12:00:00Z")
        add_tombstone(batch, "t1", {"group_id": "g1", "is_public": False}, "2026-03-03T12:00:00Z")

        assert mock_collection.document.call_args_list == [(), ()]
        assert batch.set.call_count == 2


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

    def test_a_trail_removed_several_times_is_listed_once(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [
            _doc({"trail_id": "a", "group_id": None, "is_public": True}),
            _doc({"trail_id": "b", "group_id": "g1"}),
            _doc({"trail_id": "a", "group_id": "g1", "is_public": False}),
        ]

        assert get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id="g1") == ["a", "b"]

    def test_a_later_private_removal_does_not_hide_an_earlier_public_one(self, mock_collection) -> None:
        """A lagging group that saw the public trail must still be told, even after a private re-delete."""
        mock_collection.where.return_value.stream.return_value = [
            _doc({"trail_id": "a", "group_id": "owner", "is_public": True}),
            _doc({"trail_id": "a", "group_id": "owner", "is_public": False}),
        ]

        assert get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id="lagging") == ["a"]

    def test_skips_empty_documents(self, mock_collection) -> None:
        mock_collection.where.return_value.stream.return_value = [_doc({})]

        assert get_deleted_trail_ids("2026-03-01T00:00:00Z", group_id=None) == []
