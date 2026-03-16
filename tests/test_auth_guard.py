"""Tests for production auth bypass guard in api/auth/firebase.py."""

import asyncio
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from api.auth.firebase import _guard_production_bypass, get_current_user, require_auth
from api.auth.helpers import require_group
from api.auth.models import AuthenticatedUser


def _run(coro: Any) -> Any:
    """Run an async function synchronously."""
    return asyncio.run(coro)


class TestGuardProductionBypass:
    """Tests for the _guard_production_bypass helper."""

    def test_raises_when_k_service_is_set(self) -> None:
        with (
            patch.dict("os.environ", {"K_SERVICE": "skane-trails-api"}),
            pytest.raises(RuntimeError, match="not allowed in production"),
        ):
            _guard_production_bypass("SKIP_AUTH")

    def test_allows_when_k_service_not_set(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            _guard_production_bypass("SKIP_AUTH")


class TestGetCurrentUserProductionGuard:
    """Tests for SKIP_AUTH production guard in get_current_user."""

    def test_skip_auth_blocked_in_production(self) -> None:
        creds = MagicMock(spec=HTTPAuthorizationCredentials)
        with (
            patch.dict("os.environ", {"SKIP_AUTH": "true", "K_SERVICE": "api"}),
            pytest.raises(RuntimeError, match="not allowed in production"),
        ):
            _run(get_current_user(creds))

    def test_skip_auth_works_locally(self) -> None:
        creds = MagicMock(spec=HTTPAuthorizationCredentials)
        env = {"SKIP_AUTH": "true"}
        with patch.dict("os.environ", env, clear=True):
            result = _run(get_current_user(creds))

        assert result is not None
        assert result.uid == "dev-user"
        assert result.email == "dev@localhost"

    def test_skip_auth_returns_none_without_credentials(self) -> None:
        env = {"SKIP_AUTH": "true"}
        with patch.dict("os.environ", env, clear=True):
            result = _run(get_current_user(None))

        assert result is None


class TestRequireAuthProductionGuard:
    """Tests for SKIP_AUTH production guard in require_auth."""

    def test_skip_auth_blocked_in_production(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test")
        with (
            patch.dict("os.environ", {"SKIP_AUTH": "true", "K_SERVICE": "api"}),
            pytest.raises(RuntimeError, match="not allowed in production"),
        ):
            _run(require_auth(user))

    def test_skip_auth_returns_dev_user_locally(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test")
        env = {"SKIP_AUTH": "true"}
        with patch.dict("os.environ", env, clear=True):
            result = _run(require_auth(user))

        assert result.uid == "dev-user"
        assert result.email == "dev@localhost"

    def test_require_auth_raises_401_when_no_user(self) -> None:
        env: dict[str, str] = {}
        with patch.dict("os.environ", env, clear=True):
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                _run(require_auth(None))
            assert exc_info.value.status_code == 401

    def test_require_auth_returns_user_when_provided(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test")
        resolved = AuthenticatedUser(uid="u1", email="a@b.com", name="Test", group_id="grp-1", role="admin")
        env: dict[str, str] = {}
        with (
            patch.dict("os.environ", env, clear=True),
            patch("api.auth.firebase._resolve_user_access", return_value=resolved),
        ):
            result = _run(require_auth(user))
        assert result.uid == "u1"
        assert result.email == "a@b.com"
        assert result.group_id == "grp-1"
        assert result.role == "admin"

    def test_require_auth_raises_403_when_not_authorized(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test")
        env: dict[str, str] = {}
        with (
            patch.dict("os.environ", env, clear=True),
            patch("api.auth.firebase._resolve_user_access", return_value=None),
        ):
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                _run(require_auth(user))
            assert exc_info.value.status_code == 403


class TestRequireGroup:
    """Tests for require_group helper."""

    def test_returns_group_id_when_present(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test", group_id="grp-1", role="admin")
        assert require_group(user) == "grp-1"

    def test_raises_403_when_no_group(self) -> None:
        user = AuthenticatedUser(uid="u1", email="a@b.com", name="Test", role="superuser")
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            require_group(user)
        assert exc_info.value.status_code == 403
