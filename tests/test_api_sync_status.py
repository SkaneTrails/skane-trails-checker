"""Tests for the per-data-type sync status markers and endpoint."""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.auth import AuthenticatedUser, require_auth
from api.main import app
from api.storage.sync_status import SYNC_KINDS, get_status, touch


@pytest.fixture
def mock_collection() -> Generator[MagicMock]:
    with patch("api.storage.sync_status.get_collection") as mock_get:
        mock_coll = MagicMock()
        mock_get.return_value = mock_coll
        yield mock_coll


def _doc(data: dict | None, *, exists: bool = True) -> MagicMock:
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = data
    return doc


class TestTouch:
    def test_sets_a_new_version_for_the_kind_and_keeps_the_others(self, mock_collection) -> None:
        touch("places")

        mock_collection.document.assert_called_once_with("sync_status")
        args, kwargs = mock_collection.document.return_value.set.call_args
        assert list(args[0]) == ["places"]
        assert kwargs == {"merge": True}

    def test_several_kinds_are_written_together(self, mock_collection) -> None:
        touch("trails", "images")

        mock_collection.document.return_value.set.assert_called_once()
        assert set(mock_collection.document.return_value.set.call_args.args[0]) == {"trails", "images"}

    def test_with_a_batch_the_versions_are_queued_not_written(self, mock_collection) -> None:
        batch = MagicMock()

        touch("trails", "images", batch=batch)

        mock_collection.document.return_value.set.assert_not_called()
        ref, versions = batch.set.call_args.args
        assert ref is mock_collection.document.return_value
        assert set(versions) == {"trails", "images"}
        assert batch.set.call_args.kwargs == {"merge": True}

    def test_every_touch_gets_a_different_version(self, mock_collection) -> None:
        touch("trails")
        touch("trails")

        versions = [call.args[0]["trails"] for call in mock_collection.document.return_value.set.call_args_list]
        assert versions[0] != versions[1]

    def test_rejects_an_unknown_kind(self, mock_collection) -> None:
        with pytest.raises(ValueError, match="Unknown sync kind"):
            touch("recipes")

        mock_collection.document.return_value.set.assert_not_called()


class TestGetStatus:
    def test_returns_every_kind(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _doc({"trails": "v1", "places": "v2"})

        status = get_status()

        assert set(status) == set(SYNC_KINDS)
        assert status["trails"] == "v1"
        assert status["places"] == "v2"
        assert status["images"] is None

    def test_missing_document_means_nothing_was_written_yet(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _doc(None, exists=False)

        assert get_status() == dict.fromkeys(SYNC_KINDS)

    def test_empty_document(self, mock_collection) -> None:
        mock_collection.document.return_value.get.return_value = _doc(None)

        assert get_status() == dict.fromkeys(SYNC_KINDS)


class TestSyncStatusEndpoint:
    @patch("api.routers.sync.get_status")
    def test_returns_the_status_to_a_signed_in_user(self, mock_status, authenticated_client) -> None:
        mock_status.return_value = {
            "trails": "v1",
            "places": None,
            "foraging_spots": "v3",
            "foraging_types": None,
            "images": "v5",
        }

        response = authenticated_client.get("/api/v1/sync/status")

        assert response.status_code == 200
        assert response.json() == {**mock_status.return_value, "scope": "group:test-group"}

    @patch("api.routers.sync.get_status", return_value=dict.fromkeys(SYNC_KINDS))
    def test_a_superuser_has_their_group_scope(self, mock_status, superuser_client) -> None:
        assert superuser_client.get("/api/v1/sync/status").json()["scope"] == "group:test-group"

    @patch("api.routers.sync.get_status", return_value=dict.fromkeys(SYNC_KINDS))
    def test_a_user_without_a_group_has_scope_none(self, mock_status, authenticated_client) -> None:
        user = AuthenticatedUser(uid="u", email="u@example.com", name="U", role="member")
        app.dependency_overrides[require_auth] = lambda: user

        assert authenticated_client.get("/api/v1/sync/status").json()["scope"] == "none"

    def test_requires_authentication(self, unauthenticated_client) -> None:
        assert unauthenticated_client.get("/api/v1/sync/status").status_code == 401

    def test_is_not_found_without_the_router_prefix(self) -> None:
        assert TestClient(app).get("/sync/status").status_code == 404
