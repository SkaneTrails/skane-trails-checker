"""Tests for track management functions."""

import pandas as pd

from app.functions.tracks import (
    calculate_track_distance,
    load_track_statuses,
    save_track_statuses,
    simplify_track_coordinates,
)


class TestCalculateTrackDistance:
    """Tests for track distance calculation."""

    def test_single_segment_simple_distance(self) -> None:
        """Test distance calculation for a simple single-segment track."""
        # Two points roughly 1km apart in Skåne
        segments = [[(56.0, 13.0), (56.009, 13.0)]]  # ~1km north

        result = calculate_track_distance(segments)

        assert result["segment_count"] == 1
        assert result["point_count"] == 2
        # Distance should be approximately 1km (allowing some tolerance)
        assert 0.9 <= result["distance_km"] <= 1.1

    def test_multiple_segments(self) -> None:
        """Test distance calculation with multiple segments."""
        segments = [
            [(56.0, 13.0), (56.009, 13.0)],  # ~1km
            [(56.1, 13.0), (56.109, 13.0)],  # ~1km
        ]

        result = calculate_track_distance(segments)

        assert result["segment_count"] == 2
        assert result["point_count"] == 4
        # Total should be approximately 2km
        assert 1.8 <= result["distance_km"] <= 2.2

    def test_empty_segments(self) -> None:
        """Test distance calculation with no segments."""
        segments: list[list[tuple[float, float]]] = []

        result = calculate_track_distance(segments)

        assert result["distance_km"] == 0.0
        assert result["segment_count"] == 0
        assert result["point_count"] == 0

    def test_single_point_segment(self) -> None:
        """Test distance calculation with a segment containing only one point."""
        segments = [[(56.0, 13.0)]]

        result = calculate_track_distance(segments)

        assert result["distance_km"] == 0.0
        assert result["segment_count"] == 1
        assert result["point_count"] == 1

    def test_longer_track(self) -> None:
        """Test distance calculation for a longer track with multiple points."""
        # A track with 5 points, each roughly 500m apart
        segments = [
            [
                (56.0, 13.0),
                (56.0045, 13.0),  # ~500m
                (56.009, 13.0),  # ~500m
                (56.0135, 13.0),  # ~500m
                (56.018, 13.0),  # ~500m
            ]
        ]

        result = calculate_track_distance(segments)

        assert result["segment_count"] == 1
        assert result["point_count"] == 5
        # Total should be approximately 2km
        assert 1.8 <= result["distance_km"] <= 2.2


def test_load_track_statuses_nonexistent_file() -> None:
    """Test loading track statuses from a non-existent file."""
    result = load_track_statuses("/path/that/does/not/exist.csv")
    assert result == {}


def test_load_track_statuses_valid_file(sample_track_status_csv) -> None:
    """Test loading track statuses from a valid CSV file."""
    result = load_track_statuses(str(sample_track_status_csv))

    assert len(result) == 2
    assert result[0] == "To Explore"
    assert result[1] == "Explored!"


def test_save_track_statuses(temp_data_dir) -> None:
    """Test saving track statuses to CSV."""
    track_status = {0: "To Explore", 1: "Explored!", 2: "To Explore"}

    csv_file = temp_data_dir / "test_status.csv"
    result = save_track_statuses(track_status, str(csv_file))

    assert result is True
    assert csv_file.exists()

    # Verify the content
    saved_data = pd.read_csv(csv_file)
    assert len(saved_data) == 3
    assert list(saved_data.columns) == ["track_id", "status", "last_updated"]
    assert saved_data.iloc[0]["track_id"] == 0
    assert saved_data.iloc[0]["status"] == "To Explore"


def test_simplify_track_coordinates_basic() -> None:
    """Test coordinate simplification with RDP algorithm."""
    coordinates = [(56.0, 13.0), (56.01, 13.01), (56.02, 13.02), (56.03, 13.03), (56.1, 13.1)]

    result = simplify_track_coordinates(coordinates, tolerance=0.001)

    # Should have fewer points than original
    assert len(result) <= len(coordinates)
    # First and last points should be preserved
    assert tuple(result[0]) == coordinates[0]
    assert tuple(result[-1]) == coordinates[-1]


def test_simplify_track_coordinates_two_points() -> None:
    """Test that tracks with 2 or fewer points are not simplified."""
    coordinates = [(56.0, 13.0), (56.1, 13.1)]
    result = simplify_track_coordinates(coordinates)
    assert result == coordinates


def test_simplify_track_coordinates_single_point() -> None:
    """Test that tracks with a single point are not simplified."""
    coordinates = [(56.0, 13.0)]
    result = simplify_track_coordinates(coordinates)
    assert result == coordinates
