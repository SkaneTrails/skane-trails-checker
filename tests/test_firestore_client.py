"""Tests for Firestore client wrapper."""

import os
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from api.storage.firestore_client import FirestoreConfig, get_collection, get_firestore_client


@pytest.fixture
def mock_firestore_client() -> Generator:
    """Mock Firestore client."""
    with patch("api.storage.firestore_client.firestore.Client") as mock_client:
        yield mock_client


@pytest.fixture
def mock_secret_manager() -> Generator:
    """Mock Secret Manager client."""
    with patch("api.storage.firestore_client.secretmanager.SecretManagerServiceClient") as mock_sm:
        mock_instance = MagicMock()
        mock_sm.return_value = mock_instance
        yield mock_instance


@pytest.fixture(autouse=True)
def clear_lru_cache() -> Generator:
    """Clear the LRU cache before each test."""
    get_firestore_client.cache_clear()
    yield
    get_firestore_client.cache_clear()


@pytest.fixture(autouse=True)
def clean_environment() -> Generator:
    """Clean environment variables before and after each test."""
    original_env = os.environ.copy()
    # Clear any Firestore-related env vars
    for key in [
        "FIRESTORE_PROJECT_ID",
        "FIRESTORE_DATABASE_ID",
        "FIRESTORE_LOCATION_ID",
        "GOOGLE_CLOUD_PROJECT",
        "GCP_PROJECT",
    ]:
        os.environ.pop(key, None)
    yield
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


class TestFirestoreConfig:
    """Tests for FirestoreConfig class."""

    def test_init_with_all_parameters(self) -> None:
        """Test FirestoreConfig initialization with all parameters."""
        config = FirestoreConfig(project_id="test-project", database_id="test-database", location_id="eur3")

        assert config.project_id == "test-project"
        assert config.database_id == "test-database"
        assert config.location_id == "eur3"

    def test_init_without_location(self) -> None:
        """Test FirestoreConfig initialization without location."""
        config = FirestoreConfig(project_id="test-project", database_id="test-database")

        assert config.project_id == "test-project"
        assert config.database_id == "test-database"
        assert config.location_id is None


class TestGetFirestoreClient:
    """Tests for get_firestore_client function."""

    def test_get_client_from_environment_variables(self, mock_firestore_client) -> None:
        """Test getting Firestore client from environment variables."""
        os.environ["FIRESTORE_PROJECT_ID"] = "test-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "test-database"
        os.environ["FIRESTORE_LOCATION_ID"] = "eur3"

        get_firestore_client()

        mock_firestore_client.assert_called_once_with(project="test-project", database="test-database")

    def test_get_client_from_env_without_location(self, mock_firestore_client) -> None:
        """Test getting client from env vars without location."""
        os.environ["FIRESTORE_PROJECT_ID"] = "test-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "test-database"

        get_firestore_client()

        mock_firestore_client.assert_called_once_with(project="test-project", database="test-database")

    def test_get_client_from_secret_manager(self, mock_firestore_client, mock_secret_manager) -> None:
        """Test getting Firestore client from Secret Manager."""
        os.environ["GOOGLE_CLOUD_PROJECT"] = "test-project"

        # Mock secret responses
        def mock_access_secret(request):  # noqa: ANN202
            secret_name = request["name"]
            response = MagicMock()
            if "firestore_database_name" in secret_name:
                response.payload.data = b"test-database"
            elif "firestore_location_id" in secret_name:
                response.payload.data = b"eur3"
            return response

        mock_secret_manager.access_secret_version.side_effect = mock_access_secret

        get_firestore_client()

        mock_firestore_client.assert_called_once_with(project="test-project", database="test-database")

    def test_get_client_from_secret_manager_with_gcp_project_env(
        self, mock_firestore_client, mock_secret_manager
    ) -> None:
        """Test using GCP_PROJECT env variable."""
        os.environ["GCP_PROJECT"] = "test-project"

        # Mock secret responses
        def mock_access_secret(request):  # noqa: ANN202
            response = MagicMock()
            if "firestore_database_name" in request["name"]:
                response.payload.data = b"test-database"
            elif "firestore_location_id" in request["name"]:
                response.payload.data = b"eur3"
            return response

        mock_secret_manager.access_secret_version.side_effect = mock_access_secret

        get_firestore_client()

        assert mock_firestore_client.called

    def test_get_client_secret_manager_failure(self, mock_secret_manager) -> None:
        """Test failure when Secret Manager access fails."""
        os.environ["GOOGLE_CLOUD_PROJECT"] = "test-project"
        mock_secret_manager.access_secret_version.side_effect = Exception("Access denied")

        with pytest.raises(ValueError, match="Failed to load Firestore config from Secret Manager"):
            get_firestore_client()

    def test_get_client_no_configuration(self) -> None:
        """Test error when no configuration is available."""
        with pytest.raises(ValueError, match="No Firestore configuration found"):
            get_firestore_client()

    def test_get_client_env_vars_take_precedence(self, mock_firestore_client, mock_secret_manager) -> None:
        """Test that environment variables take precedence over Secret Manager."""
        os.environ["FIRESTORE_PROJECT_ID"] = "env-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "env-database"
        os.environ["GOOGLE_CLOUD_PROJECT"] = "secret-project"

        get_firestore_client()

        # Should use env vars, not call Secret Manager
        assert not mock_secret_manager.access_secret_version.called
        mock_firestore_client.assert_called_once_with(project="env-project", database="env-database")

    def test_get_client_caching(self, mock_firestore_client) -> None:
        """Test that client is cached with lru_cache."""
        os.environ["FIRESTORE_PROJECT_ID"] = "test-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "test-database"

        # Call twice
        client1 = get_firestore_client()
        client2 = get_firestore_client()

        # Should only create client once due to caching
        assert mock_firestore_client.call_count == 1
        assert client1 is client2


class TestGetCollection:
    """Tests for get_collection function."""

    def test_get_collection(self, mock_firestore_client) -> None:
        """Test getting a collection reference."""
        os.environ["FIRESTORE_PROJECT_ID"] = "test-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "test-database"

        mock_client_instance = MagicMock()
        mock_firestore_client.return_value = mock_client_instance

        get_collection("test_collection")

        mock_client_instance.collection.assert_called_once_with("test_collection")

    def test_get_multiple_collections(self, mock_firestore_client) -> None:
        """Test getting multiple collection references."""
        os.environ["FIRESTORE_PROJECT_ID"] = "test-project"
        os.environ["FIRESTORE_DATABASE_ID"] = "test-database"

        mock_client_instance = MagicMock()
        mock_firestore_client.return_value = mock_client_instance

        get_collection("trails")
        get_collection("trail_details")

        assert mock_client_instance.collection.call_count == 2
