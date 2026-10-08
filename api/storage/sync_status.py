"""Change markers per data type, so clients can poll one small document to see what changed.

`_meta/sync_status` holds one opaque version per data type. Every write path calls `touch` with the
batch or transaction that writes its data, so the version changes exactly when the data does.
Clients remember the versions they last
synced and refetch only the types whose version differs. Versions are compared for equality, never
ordered, so clock differences and writes landing mid-sync cannot hide a change.
"""

from typing import Any
from uuid import uuid4

from api.storage.firestore_client import get_collection

SYNC_KINDS = ("trails", "places", "foraging_spots", "foraging_types", "images")


def touch(*kinds: str, batch: Any = None) -> None:
    """Mark data types as changed by giving each a new version.

    Args:
        *kinds: Members of SYNC_KINDS.
        batch: A Firestore write batch to add the change to, so it commits atomically with the data
            it announces. Without one the versions are written immediately.

    Raises:
        ValueError: If a kind is not a known data type.
    """
    for kind in kinds:
        if kind not in SYNC_KINDS:
            msg = f"Unknown sync kind: {kind!r}"
            raise ValueError(msg)
    versions = {kind: uuid4().hex for kind in kinds}
    status_ref = get_collection("_meta").document("sync_status")
    if batch is None:
        status_ref.set(versions, merge=True)
    else:
        batch.set(status_ref, versions, merge=True)


def get_status() -> dict[str, str | None]:
    """Get the current version of every data type (None for one that was never written)."""
    doc = get_collection("_meta").document("sync_status").get()
    data = (doc.to_dict() if doc.exists else None) or {}
    return {kind: data.get(kind) for kind in SYNC_KINDS}
