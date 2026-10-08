"""Change markers per data type, so clients can poll one small document to see what changed.

`_meta/sync_status` holds one opaque version per data type. Every write path calls `touch` after
its data is written, which replaces that type's version. Clients remember the versions they last
synced and refetch only the types whose version differs. Versions are compared for equality, never
ordered, so clock differences and writes landing mid-sync cannot hide a change.
"""

from uuid import uuid4

from api.storage.firestore_client import get_collection

SYNC_KINDS = ("trails", "places", "foraging_spots", "foraging_types", "images")


def touch(kind: str) -> None:
    """Mark a data type as changed by giving it a new version.

    Args:
        kind: One of SYNC_KINDS.

    Raises:
        ValueError: If kind is not a known data type.
    """
    if kind not in SYNC_KINDS:
        msg = f"Unknown sync kind: {kind!r}"
        raise ValueError(msg)
    get_collection("_meta").document("sync_status").set({kind: uuid4().hex}, merge=True)


def get_status() -> dict[str, str | None]:
    """Get the current version of every data type (None for one that was never written)."""
    doc = get_collection("_meta").document("sync_status").get()
    data = (doc.to_dict() if doc.exists else None) or {}
    return {kind: data.get(kind) for kind in SYNC_KINDS}
