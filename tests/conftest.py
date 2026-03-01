"""Pytest configuration and shared fixtures."""

import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.auth import AuthenticatedUser, require_auth
from api.main import app


@pytest.fixture
def authenticated_client() -> Generator[TestClient]:
    """Test client with auth dependency overridden to return a test user."""

    async def _mock_auth() -> AuthenticatedUser:
        return AuthenticatedUser(uid="test-user", email="test@example.com", name="Test User")

    app.dependency_overrides[require_auth] = _mock_auth
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client() -> Generator[TestClient]:
    """Test client with auth dependency overridden to raise 401."""
    from fastapi import HTTPException, status

    async def _mock_no_auth() -> AuthenticatedUser:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    app.dependency_overrides[require_auth] = _mock_no_auth
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def temp_dir() -> Generator[Path]:
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_data_dir(temp_dir) -> Path:
    """Alias for temp_dir to support both naming conventions."""
    return temp_dir


@pytest.fixture
def sample_gpx_file(temp_data_dir) -> Path:
    """Create a minimal valid GPX file for testing."""
    gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
    <trk>
        <name>Test Track</name>
        <trkseg>
            <trkpt lat="56.0" lon="13.0"></trkpt>
            <trkpt lat="56.1" lon="13.1"></trkpt>
            <trkpt lat="56.2" lon="13.2"></trkpt>
        </trkseg>
    </trk>
</gpx>"""
    gpx_file = temp_data_dir / "test_track.gpx"
    gpx_file.write_text(gpx_content)
    return gpx_file
