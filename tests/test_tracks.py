"""Tests for track management functions."""

import pandas as pd

from app.functions.tracks import load_track_statuses, save_track_statuses, simplify_track_coordinates


class TestSimplifyTrackCoordinates:
    """Test coordinate simplification using RDP algorithm."""

    def test_simplify_returns_endpoints_for_straight_line(self) -> None:
        """Straight line should simplify to just start and end points."""
        coords = [(0.0, 0.0), (0.1, 0.1), (0.2, 0.2), (0.3, 0.3)]
        simplified = simplify_track_coordinates(coords, tolerance=0.01)
        assert len(simplified) == 2  # Only start and end
        assert simplified[0] == (0.0, 0.0)
        assert simplified[-1] == (0.3, 0.3)

    def test_simplify_preserves_significant_points(self) -> None:
        """Points that deviate significantly should be preserved."""
        coords = [(0.0, 0.0), (0.1, 0.1), (0.2, 0.5), (0.3, 0.3)]  # (0.2, 0.5) is significant
        simplified = simplify_track_coordinates(coords, tolerance=0.01)
        assert len(simplified) > 2  # Should keep the peak

    def test_simplify_handles_short_tracks(self) -> None:
        """Tracks with 2 or fewer points should not be simplified."""
        coords = [(0.0, 0.0), (0.1, 0.1)]
        simplified = simplify_track_coordinates(coords)
        assert simplified == coords

    def test_simplify_empty_list(self) -> None:
        """Empty coordinate list should return empty."""
        simplified = simplify_track_coordinates([])
        assert simplified == []


class TestTrackStatuses:
    """Test loading and saving track statuses."""

    def test_load_track_statuses_existing_file(self, sample_track_status_csv) -> None:
        """Load track statuses from an existing CSV file."""
        statuses = load_track_statuses(str(sample_track_status_csv))
        assert isinstance(statuses, dict)
        assert statuses[0] == "To Explore"
        assert statuses[1] == "Explored!"

    def test_load_track_statuses_nonexistent_file(self, temp_dir) -> None:
        """Loading from non-existent file should return empty dict."""
        fake_file = temp_dir / "nonexistent.csv"
        statuses = load_track_statuses(str(fake_file))
        assert statuses == {}

    def test_save_track_statuses(self, temp_dir) -> None:
        """Save track statuses to CSV file."""
        csv_file = temp_dir / "new_status.csv"
        statuses = {0: "To Explore", 1: "Explored!", 2: "To Explore"}

        result = save_track_statuses(statuses, str(csv_file))
        assert result is True
        assert csv_file.exists()

        # Verify the saved content
        saved_data = pd.read_csv(csv_file)
        assert len(saved_data) == 3
        assert set(saved_data["track_id"].tolist()) == {0, 1, 2}
        assert set(saved_data["status"].tolist()) == {"To Explore", "Explored!"}

    def test_save_track_statuses_creates_directory(self, temp_dir) -> None:
        """Save should create directory if it doesn't exist."""
        nested_path = temp_dir / "nested" / "dir" / "status.csv"
        statuses = {0: "To Explore"}

        result = save_track_statuses(statuses, str(nested_path))
        assert result is True
        assert nested_path.exists()

    def test_save_and_load_roundtrip(self, temp_dir) -> None:
        """Save and load should preserve data."""
        csv_file = temp_dir / "roundtrip.csv"
        original = {0: "To Explore", 5: "Explored!", 10: "To Explore"}

        save_track_statuses(original, str(csv_file))
        loaded = load_track_statuses(str(csv_file))

        assert loaded == original
