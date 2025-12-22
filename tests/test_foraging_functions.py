"""Tests for foraging data functions."""

import pandas as pd
import pytest

from app.functions.foraging import Foraging


@pytest.fixture
def foraging_instance() -> Foraging:
    """Create a Foraging instance for testing."""
    return Foraging()


def test_load_foraging_data_nonexistent_file(foraging_instance) -> None:
    """Test loading foraging data from a non-existent file."""
    result = foraging_instance.load_foraging_data("/path/that/does/not/exist.csv")

    # Should return empty dict with all months
    assert len(result) == 12
    assert all(month in result for month in Foraging.short_months)
    assert all(result[month] == [] for month in Foraging.short_months)


def test_load_foraging_data_valid_file(foraging_instance, sample_foraging_csv) -> None:
    """Test loading foraging data from a valid CSV file."""
    result = foraging_instance.load_foraging_data(str(sample_foraging_csv))

    assert len(result) == 12
    assert len(result["Jan"]) == 1
    assert len(result["Jul"]) == 1

    jan_item = result["Jan"][0]
    assert jan_item["type"] == "Mushroom"
    assert jan_item["lat"] == 56.0
    assert jan_item["lng"] == 13.0
    assert jan_item["notes"] == "Test mushroom spot"


def test_save_foraging_data(foraging_instance, temp_data_dir) -> None:
    """Test saving foraging data to CSV."""
    data_dict = {
        "Jan": [{"type": "Mushroom", "lat": 56.0, "lng": 13.0, "notes": "Test", "date": "2025-01-15"}],
        "Feb": [],
        "Mar": [],
        "Apr": [],
        "May": [],
        "Jun": [],
        "Jul": [{"type": "Berries", "lat": 56.1, "lng": 13.1, "notes": "Another", "date": "2025-07-20"}],
        "Aug": [],
        "Sep": [],
        "Oct": [],
        "Nov": [],
        "Dec": [],
    }

    csv_file = temp_data_dir / "test_foraging.csv"
    result = foraging_instance.save_foraging_data(data_dict, str(csv_file))

    assert result is True
    assert csv_file.exists()

    # Verify the content
    saved_data = pd.read_csv(csv_file)
    assert len(saved_data) == 2
    assert list(saved_data.columns) == ["month", "type", "lat", "lng", "notes", "date"]


def test_load_foraging_types_default(foraging_instance) -> None:
    """Test that default foraging types are loaded when file doesn't exist."""
    result = foraging_instance.load_foraging_types()

    # Should return default types
    assert isinstance(result, dict)
    assert len(result) > 0
    assert all("icon" in value for value in result.values())


def test_save_and_load_foraging_types(foraging_instance, temp_data_dir) -> None:
    """Test saving and loading custom foraging types."""
    from pathlib import Path

    # Temporarily change the foraging_types_path
    original_path = foraging_instance.foraging_types_path
    foraging_instance.foraging_types_path = Path(temp_data_dir / "foraging_types.json")

    try:
        custom_types = {
            "Mushroom": {"icon": "🍄"},
            "Berries": {"icon": "🫐"},
            "Custom": {"icon": "🌿"},
        }

        # Save
        result = foraging_instance.save_foraging_types(custom_types)
        assert result is True

        # Load and verify
        loaded_types = foraging_instance.load_foraging_types()
        assert loaded_types == custom_types

    finally:
        foraging_instance.foraging_types_path = original_path
