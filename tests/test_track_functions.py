"""Tests for track management functions."""

import pytest

from api.models.trail import Coordinate, TrailBounds, TrailResponse
from app.functions.tracks import (
    TrackInfo,
    calculate_track_distance,
    filter_trails,
    get_distance_range,
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


def test_simplify_track_coordinates_3d() -> None:
    """Test 3D coordinate simplification preserves elevation."""
    coordinates = [
        (56.0, 13.0, 100.0),
        (56.01, 13.01, 120.0),
        (56.02, 13.02, 140.0),
        (56.03, 13.03, 130.0),
        (56.1, 13.1, 200.0),
    ]

    result = simplify_track_coordinates(coordinates, tolerance=0.001)

    assert len(result) <= len(coordinates)
    # First and last points preserved with elevation
    assert len(result[0]) == 3
    assert result[0] == (56.0, 13.0, 100.0)
    assert result[-1] == (56.1, 13.1, 200.0)


# Tests for filter_trails (Trail objects from Firestore)


@pytest.fixture
def sample_trail_objects() -> list[TrailResponse]:
    """Sample Trail objects for filtering tests."""
    return [
        TrailResponse(
            trail_id="trail-1",
            name="Söderåsen Trail North",
            difficulty="medium",
            length_km=5.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)],
            bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
            center=Coordinate(lat=56.05, lng=13.05),
            source="other_trails",
            last_updated="2024-01-01T00:00:00Z",
        ),
        TrailResponse(
            trail_id="trail-2",
            name="Kullaberg Coastal Path",
            difficulty="hard",
            length_km=12.5,
            status="Explored!",
            coordinates_map=[Coordinate(lat=56.2, lng=12.4), Coordinate(lat=56.3, lng=12.5)],
            bounds=TrailBounds(north=56.3, south=56.2, east=12.5, west=12.4),
            center=Coordinate(lat=56.25, lng=12.45),
            source="other_trails",
            last_updated="2024-01-01T00:00:00Z",
        ),
        TrailResponse(
            trail_id="trail-3",
            name="Skåneleden Stage 1",
            difficulty="easy",
            length_km=20.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=55.9, lng=13.0), Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.0, south=55.9, east=13.0, west=13.0),
            center=Coordinate(lat=55.95, lng=13.0),
            source="planned_hikes",  # This is the Skåneleden source
            last_updated="2024-01-01T00:00:00Z",
        ),
        TrailResponse(
            trail_id="trail-4",
            name="Short Beach Walk",
            difficulty="easy",
            length_km=2.0,
            status="Explored!",
            coordinates_map=[Coordinate(lat=55.5, lng=12.9), Coordinate(lat=55.6, lng=12.9)],
            bounds=TrailBounds(north=55.6, south=55.5, east=12.9, west=12.9),
            center=Coordinate(lat=55.55, lng=12.9),
            source="world_wide_hikes",
            last_updated="2024-01-01T00:00:00Z",
        ),
    ]


class TestFilterTrails:
    """Tests for Trail object filtering functionality."""

    def test_filter_trails_by_search_query(self, sample_trail_objects) -> None:
        """Filter Trail objects by name search."""
        result = filter_trails(sample_trail_objects, search_query="söderåsen")

        assert len(result) == 1
        assert result[0].name == "Söderåsen Trail North"

    def test_filter_trails_by_search_case_insensitive(self, sample_trail_objects) -> None:
        """Search should be case-insensitive."""
        result = filter_trails(sample_trail_objects, search_query="KULLABERG")

        assert len(result) == 1
        assert result[0].name == "Kullaberg Coastal Path"

    def test_filter_trails_by_min_distance(self, sample_trail_objects) -> None:
        """Filter trails by minimum distance."""
        result = filter_trails(sample_trail_objects, min_distance_km=10.0)

        # Should include Kullaberg (12.5km) and Skåneleden (20km, but exempt from distance filter)
        assert len(result) == 2
        names = [t.name for t in result]
        assert "Kullaberg Coastal Path" in names
        assert "Skåneleden Stage 1" in names

    def test_filter_trails_planned_hikes_exempt_from_distance_filter(self, sample_trail_objects) -> None:
        """Planned hikes (Skåneleden) should be exempt from distance filtering."""
        # Set a very restrictive distance range that would exclude a 20km trail
        result = filter_trails(sample_trail_objects, min_distance_km=1.0, max_distance_km=3.0)

        # Short Beach Walk (2km) is within range
        # Skåneleden Stage 1 (20km) should be included despite being outside range (exempt)
        trail_names = [t.name for t in result]
        assert "Short Beach Walk" in trail_names
        assert "Skåneleden Stage 1" in trail_names  # Exempt from distance filter
        assert "Söderåsen Trail North" not in trail_names  # 5km, outside range
        assert "Kullaberg Coastal Path" not in trail_names  # 12.5km, outside range

    def test_filter_trails_by_explored_status(self, sample_trail_objects) -> None:
        """Filter trails to show only explored."""
        result = filter_trails(sample_trail_objects, show_explored_only=True)

        assert len(result) == 2
        assert all(t.status == "Explored!" for t in result)

    def test_filter_trails_by_unexplored_status(self, sample_trail_objects) -> None:
        """Filter trails to show only unexplored."""
        result = filter_trails(sample_trail_objects, show_unexplored_only=True)

        assert len(result) == 2
        assert all(t.status == "To Explore" for t in result)

    def test_filter_trails_combined_filters(self, sample_trail_objects) -> None:
        """Test combining multiple filters."""
        result = filter_trails(
            sample_trail_objects, search_query="trail", min_distance_km=3.0, show_unexplored_only=True
        )

        # Should match: Söderåsen Trail North (has "trail", 5km, unexplored)
        # Skåneleden Stage 1 has "stage" not "trail", so excluded
        assert len(result) == 1
        assert result[0].name == "Söderåsen Trail North"

    def test_filter_trails_empty_list(self) -> None:
        """Filtering empty list returns empty list."""
        result = filter_trails([], search_query="anything")
        assert result == []

    def test_filter_trails_no_filters_returns_all(self, sample_trail_objects) -> None:
        """No filters should return all trails."""
        result = filter_trails(sample_trail_objects)
        assert len(result) == len(sample_trail_objects)
