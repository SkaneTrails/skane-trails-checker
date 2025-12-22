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


@pytest.fixture
def sample_track_status_csv(temp_data_dir) -> Path:
    """Create a sample track status CSV file."""
    csv_content = """track_id,status,last_updated
0,To Explore,2025-01-01 12:00:00
1,Explored!,2025-01-02 14:30:00
"""
    csv_file = temp_data_dir / "track_status.csv"
    csv_file.write_text(csv_content)
    return csv_file


@pytest.fixture
def sample_foraging_csv(temp_data_dir) -> Path:
    """Create a sample foraging data CSV file."""
    csv_content = """month,type,lat,lng,notes,date
Jan,Mushroom,56.0,13.0,Test mushroom spot,2025-01-15
Jul,Berries,56.1,13.1,Great blueberry patch,2025-07-20
"""
    csv_file = temp_data_dir / "foraging_data.csv"
    csv_file.write_text(csv_content)
    return csv_file


@pytest.fixture
def sample_foraging_types_json(temp_data_dir) -> Path:
    """Create a sample foraging types JSON file."""
    import json

    types_data = {
        "Mushroom": {"icon": "🍄"},
        "Berries": {"icon": "🫐"},
        "Other": {"icon": "❓"},
    }
    json_file = temp_data_dir / "foraging_types.json"
    json_file.write_text(json.dumps(types_data))
    return json_file
