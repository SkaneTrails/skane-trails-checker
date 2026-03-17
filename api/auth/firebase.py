"""Firebase Authentication middleware for FastAPI.

Role-based auth matching meal-planner pattern:
- Superusers (Terraform-seeded) have global access
- Group admins manage their group members and data
- Group members have read-only access to group data
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
from api.storage.hike_group_storage import get_user_membership, is_superuser

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

_PRODUCTION_BYPASS_MSG = "Auth bypass (SKIP_AUTH/SKIP_ALLOWLIST) is not allowed in production"


def _guard_production_bypass(flag_name: str) -> None:
    """Block dev-only auth bypass flags from running in Cloud Run.

    Cloud Run always sets K_SERVICE. If we detect it, the bypass flag
    was set by mistake — fail hard to prevent an open auth door.

    Raises:
        RuntimeError: If the bypass flag is active in a Cloud Run environment.
    """
    if os.getenv("K_SERVICE"):
        msg = f"{_PRODUCTION_BYPASS_MSG} ({flag_name})"
        raise RuntimeError(msg)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthenticatedUser | None:
    """Extract and validate Firebase ID token from Authorization header.

    Returns None if no token provided (for optional auth endpoints).
    Raises HTTPException if token is invalid.
    """
    if os.getenv("SKIP_AUTH", "").lower() == "true":
        _guard_production_bypass("SKIP_AUTH")
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
    except auth.ExpiredIdTokenError:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except auth.InvalidIdTokenError:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except Exception:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


async def require_auth(user: Annotated[AuthenticatedUser | None, Depends(get_current_user)]) -> AuthenticatedUser:
    """Require authentication and resolve user's role and group membership.

    Use as a FastAPI dependency to enforce authentication on endpoints.
    Resolves superuser status and group membership from Firestore.
    """
    if os.getenv("SKIP_AUTH", "").lower() == "true":
        _guard_production_bypass("SKIP_AUTH")
        return AuthenticatedUser(
            uid="dev-user", email="dev@localhost", name="Dev User", group_id=os.getenv("DEV_GROUP_ID"), role="superuser"
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    resolved_user = _resolve_user_access(user)
    if resolved_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized to access this application"
        )

    return resolved_user


def _resolve_user_access(user: AuthenticatedUser) -> AuthenticatedUser | None:  # pragma: no cover
    """Resolve user's access level and group membership.

    Access hierarchy:
    1. Superusers (in superusers collection) — global access, optional group
    2. Group members (in group_members collection) — group-scoped access
    3. No access — returns None
    """
    if os.getenv("SKIP_ALLOWLIST", "").lower() == "true":
        _guard_production_bypass("SKIP_ALLOWLIST")
        return AuthenticatedUser(
            uid=user.uid,
            email=user.email,
            name=user.name,
            picture=user.picture,
            group_id=os.getenv("DEV_GROUP_ID"),
            role="superuser",
        )

    try:
        if is_superuser(user.email):
            membership = get_user_membership(user.email)
            return AuthenticatedUser(
                uid=user.uid,
                email=user.email,
                name=user.name,
                picture=user.picture,
                group_id=membership.group_id if membership else None,
                role="superuser",
            )

        membership = get_user_membership(user.email)
        if membership:
            return AuthenticatedUser(
                uid=user.uid,
                email=user.email,
                name=user.name,
                picture=user.picture,
                group_id=membership.group_id,
                role=membership.role,
            )

        return None

    except Exception:
        logger.exception("Error resolving user access")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authorization service temporarily unavailable"
        ) from None
