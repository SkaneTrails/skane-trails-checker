"""Firestore client re-export for API layer.

Reuses the existing Firestore client from the app layer to avoid
duplicating connection management during the Streamlit → React migration.
"""

from app.functions.firestore_client import get_collection, get_firestore_client

__all__ = ["get_collection", "get_firestore_client"]
