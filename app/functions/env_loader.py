"""Environment variable loader with .env fallback for local development.

This module should be imported at application entry points to ensure
environment variables are loaded before any other modules need them.
"""

import os


def load_env_if_needed() -> None:
    """Load .env file only if environment variables are not already set.

    Environment variables set by deployment platforms (Cloud Run, etc.)
    take precedence over .env file. The .env file is only used as a
    fallback for local development.

    This function is idempotent - safe to call multiple times.
    """
    # Check if we already have key environment variables set
    # (indicates we're running in a deployment environment or .env was already loaded)
    if os.getenv("GCP_PROJECT_ID") or os.getenv("FIRESTORE_DATABASE"):
        return

    # Try to load from .env file (local development)
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        # python-dotenv not installed (e.g., in production without dev dependencies)
        # This is fine - env vars should be set by the platform
        pass
