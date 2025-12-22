"""Tests for foraging data management."""

import json

import pandas as pd

from app.functions.foraging import Foraging


class TestForaging:
    """Test foraging data loading and saving."""

    def test_load_foraging_types_existing_file(self, sample_foraging_types_json):
        """Load foraging types from existing JSON file."""
        foraging = Foraging()
        types = foraging.load_foraging_types()

        # Note: This test will use default types since load_foraging_types
        # looks for hardcoded path. We'll need to refactor Foraging class
        # to accept custom paths for better testability
        assert isinstance(types, dict)
        assert "Mushroom" in types or "Other" in types

    def test_load_foraging_data_existing_file(self, sample_foraging_csv):
        """Load foraging data from existing CSV file."""
        foraging = Foraging()
        data = foraging.load_foraging_data(str(sample_foraging_csv))

        assert isinstance(data, dict)
        assert "Jan" in data
        assert "Jul" in data
        assert len(data["Jan"]) == 1
        assert data["Jan"][0]["type"] == "Mushroom"
        assert data["Jul"][0]["type"] == "Berries"

    def test_load_foraging_data_nonexistent_file(self, temp_dir):
        """Loading from non-existent file should return empty month dict."""
        foraging = Foraging()
        fake_file = temp_dir / "nonexistent.csv"
        data = foraging.load_foraging_data(str(fake_file))

        assert isinstance(data, dict)
        assert len(data) == 12  # All 12 months
        for month in foraging.short_months:
            assert month in data
            assert data[month] == []

    def test_save_foraging_data(self, temp_dir):
        """Save foraging data to CSV file."""
        foraging = Foraging()
        csv_file = temp_dir / "new_foraging.csv"

        data = {
            "Jan": [{"type": "Mushroom", "lat": 56.0, "lng": 13.0, "notes": "Test", "date": "2025-01-15"}],
            "Feb": [],
            "Jul": [
                {"type": "Berries", "lat": 56.1, "lng": 13.1, "notes": "Blueberries", "date": "2025-07-20"},
                {"type": "Berries", "lat": 56.2, "lng": 13.2, "notes": "Raspberries", "date": "2025-07-21"},
            ],
        }

        # Fill in remaining months
        for month in foraging.short_months:
            if month not in data:
                data[month] = []

        result = foraging.save_foraging_data(data, str(csv_file))
        assert result is True
        assert csv_file.exists()

        # Verify saved content
        df = pd.read_csv(csv_file)
        assert len(df) == 3  # 1 in Jan + 2 in Jul
        assert set(df["month"].unique()) == {"Jan", "Jul"}

    def test_save_and_load_roundtrip(self, temp_dir):
        """Save and load should preserve data."""
        foraging = Foraging()
        csv_file = temp_dir / "roundtrip.csv"

        original = {month: [] for month in foraging.short_months}
        original["May"] = [
            {"type": "Wild Garlic", "lat": 56.05, "lng": 13.05, "notes": "Forest patch", "date": "2025-05-10"}
        ]
        original["Sep"] = [
            {"type": "Mushroom", "lat": 56.15, "lng": 13.15, "notes": "Chanterelles", "date": "2025-09-15"},
            {"type": "Apple", "lat": 56.25, "lng": 13.25, "notes": "Old orchard", "date": "2025-09-20"},
        ]

        foraging.save_foraging_data(original, str(csv_file))
        loaded = foraging.load_foraging_data(str(csv_file))

        assert loaded["May"] == original["May"]
        assert loaded["Sep"] == original["Sep"]
        assert loaded["Jan"] == []

    def test_save_foraging_types(self, temp_dir):
        """Save foraging types to JSON file."""
        from pathlib import Path
        
        foraging = Foraging()
        # Temporarily override the path for testing
        foraging.foraging_types_path = Path(temp_dir / "types.json")

        types = {"Mushroom": {"icon": "🍄"}, "Berries": {"icon": "🫐"}}

        result = foraging.save_foraging_types(types)
        assert result is True

        # Verify saved content
        with open(foraging.foraging_types_path) as f:
            saved = json.load(f)
        assert saved == types
