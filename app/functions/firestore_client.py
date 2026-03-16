"""Firestore client re-export for backward compatibility.

The primary implementation now lives in api/storage/firestore_client.py.
This module re-exports for dev-tools and other legacy consumers.
"""

from api.storage.firestore_client import FirestoreConfig, get_collection, get_firestore_client  # pragma: no cover

__all__ = ["FirestoreConfig", "get_collection", "get_firestore_client"]  # pragma: no cover
