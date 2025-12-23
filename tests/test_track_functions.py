"""Tests for track management functions."""

import pandas as pd
import pytest

from app.functions.tracks import (
    TrackInfo,
    calculate_track_distance,
    filter_tracks,
    get_distance_range,
    load_track_statuses,
    save_track_statuses,
    simplify_track_coordinates,
)


@pytest.fixture
def sample_tracks() -> list[TrackInfo]:
    """Sample tracks for filtering tests."""
    return [
        {
            "track_index": 0,
            "name": "Söderåsen Trail North",
            "segments": [[(56.0, 13.0), (56.1, 13.1)]],
            "status": "To Explore",
            "distance_km": 5.0,
        },
        {
            "track_index": 1,
            "name": "Kullaberg Coastal Path",
            "segments": [[(56.2, 12.4), (56.3, 12.5)]],
            "status": "Explored!",
            "distance_km": 12.5,
        },
        {
            "track_index": 2,
            "name": "Söderåsen Trail South",
            "segments": [[(55.9, 13.0), (56.0, 13.0)]],
            "status": "To Explore",
            "distance_km": 8.0,
        },
        {
            "track_index": 3,
            "name": "Short Beach Walk",
            "segments": [[(55.5, 12.9), (55.6, 12.9)]],
            "status": "Explored!",
            "distance_km": 2.0,
        },
    ]


class TestFilterTracks:
    """Tests for track filtering functionality."""

    def test_filter_by_search_query(self, sample_tracks) -> None:
        """Filter tracks by name search."""
        result = filter_tracks(sample_tracks, search_query="söderåsen")

        assert len(result) == 2
        assert all("söderåsen" in t["name"].lower() for t in result)

    def test_filter_by_search_query_case_insensitive(self, sample_tracks) -> None:
        """Search should be case-insensitive."""
        result = filter_tracks(sample_tracks, search_query="KULLABERG")

        assert len(result) == 1
        assert result[0]["name"] == "Kullaberg Coastal Path"

    def test_filter_by_min_distance(self, sample_tracks) -> None:
        """Filter tracks by minimum distance."""
        result = filter_tracks(sample_tracks, min_distance_km=6.0)

        assert len(result) == 2
        assert all(t["distance_km"] >= 6.0 for t in result)

    def test_filter_by_max_distance(self, sample_tracks) -> None:
        """Filter tracks by maximum distance."""
        result = filter_tracks(sample_tracks, max_distance_km=6.0)

        assert len(result) == 2
        assert all(t["distance_km"] <= 6.0 for t in result)

    def test_filter_by_distance_range(self, sample_tracks) -> None:
        """Filter tracks by distance range."""
        result = filter_tracks(sample_tracks, min_distance_km=4.0, max_distance_km=10.0)

        assert len(result) == 2
        assert all(4.0 <= t["distance_km"] <= 10.0 for t in result)

    def test_filter_explored_only(self, sample_tracks) -> None:
        """Filter to show only explored tracks."""
        result = filter_tracks(sample_tracks, show_explored_only=True)

        assert len(result) == 2
        assert all(t["status"] == "Explored!" for t in result)

    def test_filter_unexplored_only(self, sample_tracks) -> None:
        """Filter to show only unexplored tracks."""
        result = filter_tracks(sample_tracks, show_unexplored_only=True)

        assert len(result) == 2
        assert all(t["status"] == "To Explore" for t in result)

    def test_filter_combined_criteria(self, sample_tracks) -> None:
        """Filter using multiple criteria."""
        result = filter_tracks(
            sample_tracks,
            search_query="trail",
            min_distance_km=3.0,
            show_unexplored_only=True,
        )

        assert len(result) == 2
        assert all("trail" in t["name"].lower() for t in result)
        assert all(t["distance_km"] >= 3.0 for t in result)
        assert all(t["status"] == "To Explore" for t in result)

    def test_filter_no_matches(self, sample_tracks) -> None:
        """Filter with criteria that match no tracks."""
        result = filter_tracks(sample_tracks, search_query="nonexistent")

        assert len(result) == 0

    def test_filter_empty_search(self, sample_tracks) -> None:
        """Empty search query should return all tracks."""
        result = filter_tracks(sample_tracks, search_query="")

        assert len(result) == len(sample_tracks)


class TestGetDistanceRange:
    """Tests for get_distance_range function."""

    def test_get_distance_range_normal(self, sample_tracks) -> None:
        """Get distance range from tracks."""
        min_dist, max_dist = get_distance_range(sample_tracks)

        assert min_dist == 2.0
        assert max_dist == 12.5

    def test_get_distance_range_empty_list(self) -> None:
        """Get distance range from empty list returns defaults."""
        min_dist, max_dist = get_distance_range([])

        assert min_dist == 0.0
        assert max_dist == 100.0


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
