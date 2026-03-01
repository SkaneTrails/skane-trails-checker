"""Pytest configuration and shared fixtures for Streamlit app testing."""

import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest


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
