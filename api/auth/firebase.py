"""Firebase Authentication middleware for FastAPI.

Simplified from meal-planner — no households/roles, just token validation.
All authenticated users have full write access.
"""

import logging
import os
from functools import lru_cache
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from api.auth.models import AuthenticatedUser

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_firebase_app() -> firebase_admin.App:  # pragma: no cover
    """Get or initialize Firebase Admin app (cached)."""
    try:
        return firebase_admin.get_app()
    except ValueError:
        cred = credentials.ApplicationDefault()
        return firebase_admin.initialize_app(cred)


security = HTTPBearer(auto_error=False)

_PRODUCTION_BYPASS_MSG = "Auth bypass (SKIP_AUTH) is not allowed in production"


def _guard_production_bypass() -> None:
    """Block dev-only SKIP_AUTH from running in Cloud Run.

    Cloud Run always sets K_SERVICE. If we detect it, the bypass flag
    was set by mistake — fail hard to prevent an open auth door.

    Raises:
        RuntimeError: If SKIP_AUTH is active in a Cloud Run environment.
    """
    if os.getenv("K_SERVICE"):
        raise RuntimeError(_PRODUCTION_BYPASS_MSG)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthenticatedUser | None:
    """Extract and validate Firebase ID token from Authorization header.

    Returns None if no token provided (for optional auth endpoints).
    Raises HTTPException if token is invalid.
    """
    if os.getenv("SKIP_AUTH", "").lower() == "true":
        _guard_production_bypass()
        if credentials is not None:
            return AuthenticatedUser(uid="dev-user", email="dev@localhost", name="Dev User")
        return None

    if credentials is None:  # pragma: no cover
        return None

    token = credentials.credentials  # pragma: no cover

    try:  # pragma: no cover
        _get_firebase_app()
        decoded_token = auth.verify_id_token(token)
        return AuthenticatedUser(
            uid=decoded_token["uid"],
            email=decoded_token.get("email", ""),
            name=decoded_token.get("name"),
            picture=decoded_token.get("picture"),
        )
    except auth.InvalidIdTokenError:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except auth.ExpiredIdTokenError:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except Exception:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


async def require_auth(user: Annotated[AuthenticatedUser | None, Depends(get_current_user)]) -> AuthenticatedUser:
    """Require authentication for an endpoint.

    Use as a FastAPI dependency to enforce authentication on write endpoints.
    """
    if os.getenv("SKIP_AUTH", "").lower() == "true":
        _guard_production_bypass()
        return AuthenticatedUser(uid="dev-user", email="dev@localhost", name="Dev User")

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
