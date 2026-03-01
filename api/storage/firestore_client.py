"""Firestore client wrapper with authentication and connection management."""

import os
from functools import lru_cache

from google.cloud import firestore, secretmanager


class FirestoreConfig:
    """Configuration for Firestore connection."""

    def __init__(self, project_id: str, database_id: str, location_id: str | None = None) -> None:
        self.project_id = project_id
        self.database_id = database_id
        self.location_id = location_id


def _get_secret(secret_name: str, project_id: str) -> str:  # pragma: no cover
    """Retrieve secret value from Secret Manager.

    Args:
        secret_name: Name of the secret (without project path)
        project_id: GCP project ID

    Returns:
        Secret value as string
    """
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")


def _load_config_from_secrets(project_id: str) -> FirestoreConfig:
    """Load Firestore configuration from Secret Manager.

    Args:
        project_id: GCP project ID for Secret Manager access

    Returns:
        FirestoreConfig with connection details
    """
    database_id = _get_secret("firestore_database_name", project_id)
    location_id = _get_secret("firestore_location_id", project_id)

    return FirestoreConfig(project_id=project_id, database_id=database_id, location_id=location_id)


def _load_config_from_env() -> FirestoreConfig | None:  # pragma: no cover
    """Load Firestore configuration from environment variables.

    Environment variables:
        FIRESTORE_PROJECT_ID: GCP project ID
        FIRESTORE_DATABASE_ID: Firestore database name
        FIRESTORE_LOCATION_ID: Firestore location (optional)

    Returns:
        FirestoreConfig if all required env vars present, None otherwise
    """
    project_id = os.getenv("FIRESTORE_PROJECT_ID")
    database_id = os.getenv("FIRESTORE_DATABASE_ID")
    location_id = os.getenv("FIRESTORE_LOCATION_ID")

    if not project_id or not database_id:
        return None

    return FirestoreConfig(project_id=project_id, database_id=database_id, location_id=location_id)


@lru_cache(maxsize=1)
def get_firestore_client() -> firestore.Client:  # pragma: no cover
    """Get or create Firestore client with proper authentication.

    Authentication flow:
        1. Try environment variables (FIRESTORE_PROJECT_ID, FIRESTORE_DATABASE_ID)
        2. Fall back to Secret Manager (for local dev with gcloud auth)
        3. Use Application Default Credentials for production

    Returns:
        Configured Firestore client

    Raises:
        ValueError: If configuration cannot be loaded
    """
    # Try environment variables first (explicit configuration)
    config = _load_config_from_env()

    # Fall back to Secret Manager for local development
    if config is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
        if project_id:
            try:
                config = _load_config_from_secrets(project_id)
            except Exception as e:
                msg = f"Failed to load Firestore config from Secret Manager: {e}"
                raise ValueError(msg) from e
        else:
            msg = (
                "No Firestore configuration found. Set FIRESTORE_PROJECT_ID and "
                "FIRESTORE_DATABASE_ID environment variables, or set GOOGLE_CLOUD_PROJECT "
                "to use Secret Manager."
            )
            raise ValueError(msg)

    # Create Firestore client with loaded configuration
    return firestore.Client(project=config.project_id, database=config.database_id)


def get_collection(collection_name: str) -> firestore.CollectionReference:  # pragma: no cover
    """Get a Firestore collection reference.

    Args:
        collection_name: Name of the collection

    Returns:
        Collection reference
    """
    client = get_firestore_client()
    return client.collection(collection_name)
