"""Sync status endpoint: which data types changed, for client polling."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.auth import AuthenticatedUser, require_auth
from api.models.sync_status import SyncStatusResponse
from api.storage.sync_status import get_status

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/status")
def get_sync_status(_user: Annotated[AuthenticatedUser, Depends(require_auth)]) -> SyncStatusResponse:
    """Get the current version of every data type.

    One small read. A client compares these with the versions it last synced and refetches only the
    data types whose version differs. The versions are opaque: compare them for equality only.
    """
    return SyncStatusResponse(**get_status())
