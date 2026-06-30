"""Shared auth helper functions for route handlers."""

from fastapi import HTTPException, status

from api.auth.models import AuthenticatedUser


def require_group(user: AuthenticatedUser) -> str:
    """Require user to have a group, return group_id.

    Raises:
        HTTPException: 403 if user has no group membership.
    """
    if not user.group_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You must be a member of a group to perform this action"
        )
    return user.group_id
