"""Sync status endpoint: which data types changed, for client polling."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.auth import AuthenticatedUser, require_auth
from api.models.sync_status import SyncStatusResponse
from api.storage.sync_status import get_status

router = APIRouter(prefix="/sync", tags=["sync"])


def _scope_of(user: AuthenticatedUser) -> str:
    if user.role == "superuser":
        return "all"
    return f"group:{user.group_id}" if user.group_id else "none"


@router.get("/status")
def get_sync_status(user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> SyncStatusResponse:
    """Get the current version of every data type.

    One small read. A client compares these with the versions it last synced and refetches only the
    data types whose version differs. The versions are opaque: compare them for equality only.
    The scope tells the client when its access changed (group moved, role changed), which none of
    the data versions reflect.
    """
    return SyncStatusResponse(**get_status(), scope=_scope_of(user))
