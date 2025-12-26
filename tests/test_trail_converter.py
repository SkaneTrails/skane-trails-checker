"""Tests for trail_converter module."""

from unittest.mock import MagicMock

import gpxpy.gpx
import pytest

from app.functions.trail_converter import gpx_track_to_trail, load_trails_from_gpx_data
from app.functions.trail_models import Trail


class TestGpxTrackToTrail:
    """Tests for gpx_track_to_trail function."""

    def test_converts_basic_track(self) -> None:
        """Test basic GPX track conversion to Trail."""
        # Create mock GPX track with basic data
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Test Trail"
        mock_track.type = "hiking"

        # Create mock segment with points
        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=100.0),
            MagicMock(latitude=55.01, longitude=13.01, elevation=110.0),
            MagicMock(latitude=55.02, longitude=13.02, elevation=105.0),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert isinstance(result, Trail)
        assert result.name == "Test Trail"
        assert result.source == "test_source"
        assert result.status == "To Explore"
        assert result.activity_type == "hiking"
        assert result.length_km > 0
        assert len(result.coordinates_map) > 0
        assert result.bounds is not None
        assert result.center is not None

    def test_converts_track_without_name(self) -> None:
        """Test conversion of unnamed track."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = None
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=5)

        assert result.name == "Unnamed Trail 5"
        assert result.activity_type is None

    def test_raises_error_for_empty_track(self) -> None:
        """Test that track with no coordinates raises ValueError."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Empty Track"
        mock_track.type = None

        # Empty segment
        mock_segment = MagicMock()
        mock_segment.points = []
        mock_track.segments = [mock_segment]

        with pytest.raises(ValueError, match="has no coordinates"):
            gpx_track_to_trail(mock_track, source="test_source", index=0)

    def test_calculates_bounds_correctly(self) -> None:
        """Test that bounds are calculated from all coordinates."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Bounds Test"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=56.0, longitude=14.0, elevation=None),
            MagicMock(latitude=54.5, longitude=12.5, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert result.bounds.north == 56.0
        assert result.bounds.south == 54.5
        assert result.bounds.east == 14.0
        assert result.bounds.west == 12.5

    def test_calculates_center_correctly(self) -> None:
        """Test that center is calculated as average of coordinates."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Center Test"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=56.0, longitude=14.0, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert result.center.lat == 55.5
        assert result.center.lng == 13.5

    def test_calculates_elevation_gain_and_loss(self) -> None:
        """Test elevation gain and loss calculation."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Elevation Test"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=100.0),
            MagicMock(latitude=55.01, longitude=13.01, elevation=150.0),  # +50
            MagicMock(latitude=55.02, longitude=13.02, elevation=130.0),  # -20
            MagicMock(latitude=55.03, longitude=13.03, elevation=180.0),  # +50
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert result.elevation_gain == 100.0  # 50 + 50
        assert result.elevation_loss == 20.0

    def test_handles_missing_elevation_data(self) -> None:
        """Test that missing elevation data is handled gracefully."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "No Elevation"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert result.elevation_gain is None
        assert result.elevation_loss is None

    def test_handles_single_elevation_point(self) -> None:
        """Test elevation calculation with only one point."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Single Elevation"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=100.0),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        # Only one elevation point, so no gain/loss calculated
        assert result.elevation_gain is None
        assert result.elevation_loss is None

    def test_extracts_activity_date_from_metadata(self) -> None:
        """Test activity date extraction from GPX metadata."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Activity Date Test"
        mock_track.type = "running"

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        activity_time = "2025-12-26T10:30:00Z"
        gpx_metadata = {"time": activity_time}

        result = gpx_track_to_trail(mock_track, source="test_source", index=0, gpx_metadata=gpx_metadata)

        assert result.activity_date == activity_time

    def test_handles_custom_status(self) -> None:
        """Test custom status parameter."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Custom Status"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0, status="Explored!")

        assert result.status == "Explored!"

    def test_handles_multiple_segments(self) -> None:
        """Test track with multiple segments."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Multi-Segment"
        mock_track.type = None

        # First segment
        mock_segment1 = MagicMock()
        mock_segment1.points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=100.0),
            MagicMock(latitude=55.01, longitude=13.01, elevation=110.0),
        ]

        # Second segment
        mock_segment2 = MagicMock()
        mock_segment2.points = [
            MagicMock(latitude=55.02, longitude=13.02, elevation=120.0),
            MagicMock(latitude=55.03, longitude=13.03, elevation=130.0),
        ]

        mock_track.segments = [mock_segment1, mock_segment2]

        result = gpx_track_to_trail(mock_track, source="test_source", index=0)

        # Should have coordinates from both segments
        assert result.length_km > 0
        assert result.elevation_gain == 30.0  # Total gain across both segments

    def test_generates_stable_trail_id(self) -> None:
        """Test that trail_id is stable for same input."""
        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Stable ID Test"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.123456, longitude=13.654321, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        result1 = gpx_track_to_trail(mock_track, source="test_source", index=0)
        result2 = gpx_track_to_trail(mock_track, source="test_source", index=0)

        assert result1.trail_id == result2.trail_id
        assert len(result1.trail_id) == 12  # MD5 hash truncated to 12 chars


class TestLoadTrailsFromGpxData:
    """Tests for load_trails_from_gpx_data function."""

    def test_returns_empty_list_for_none_data(self) -> None:
        """Test that None GPX data returns empty list."""
        result = load_trails_from_gpx_data(None, source="test_source")

        assert result == []

    def test_converts_single_track(self) -> None:
        """Test conversion of GPX with single track."""
        mock_gpx = MagicMock(spec=gpxpy.gpx.GPX)

        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Single Track"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        mock_gpx.tracks = [mock_track]

        result = load_trails_from_gpx_data(mock_gpx, source="test_source")

        assert len(result) == 1
        assert result[0].name == "Single Track"
        assert result[0].status == "To Explore"

    def test_converts_multiple_tracks(self) -> None:
        """Test conversion of GPX with multiple tracks."""
        mock_gpx = MagicMock(spec=gpxpy.gpx.GPX)

        # First track
        mock_track1 = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track1.name = "Track 1"
        mock_track1.type = None
        mock_segment1 = MagicMock()
        mock_segment1.points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_track1.segments = [mock_segment1]

        # Second track
        mock_track2 = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track2.name = "Track 2"
        mock_track2.type = None
        mock_segment2 = MagicMock()
        mock_segment2.points = [
            MagicMock(latitude=56.0, longitude=14.0, elevation=None),
            MagicMock(latitude=56.01, longitude=14.01, elevation=None),
        ]
        mock_track2.segments = [mock_segment2]

        mock_gpx.tracks = [mock_track1, mock_track2]

        result = load_trails_from_gpx_data(mock_gpx, source="test_source")

        assert len(result) == 2
        assert result[0].name == "Track 1"
        assert result[1].name == "Track 2"

    def test_applies_existing_statuses(self) -> None:
        """Test that existing statuses are applied to tracks."""
        mock_gpx = MagicMock(spec=gpxpy.gpx.GPX)

        mock_track = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track.name = "Status Test"
        mock_track.type = None

        mock_segment = MagicMock()
        mock_points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_segment.points = mock_points
        mock_track.segments = [mock_segment]

        mock_gpx.tracks = [mock_track]

        existing_statuses = {0: "Explored!"}
        result = load_trails_from_gpx_data(mock_gpx, source="test_source", existing_statuses=existing_statuses)

        assert len(result) == 1
        assert result[0].status == "Explored!"

    def test_skips_tracks_with_no_coordinates(self) -> None:
        """Test that tracks with no coordinates are skipped."""
        mock_gpx = MagicMock(spec=gpxpy.gpx.GPX)

        # Valid track
        mock_track1 = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track1.name = "Valid Track"
        mock_track1.type = None
        mock_segment1 = MagicMock()
        mock_segment1.points = [
            MagicMock(latitude=55.0, longitude=13.0, elevation=None),
            MagicMock(latitude=55.01, longitude=13.01, elevation=None),
        ]
        mock_track1.segments = [mock_segment1]

        # Empty track (should be skipped)
        mock_track2 = MagicMock(spec=gpxpy.gpx.GPXTrack)
        mock_track2.name = "Empty Track"
        mock_track2.type = None
        mock_segment2 = MagicMock()
        mock_segment2.points = []
        mock_track2.segments = [mock_segment2]

        mock_gpx.tracks = [mock_track1, mock_track2]

        result = load_trails_from_gpx_data(mock_gpx, source="test_source")

        # Should only have the valid track
        assert len(result) == 1
        assert result[0].name == "Valid Track"

    def test_handles_empty_tracks_list(self) -> None:
        """Test GPX with no tracks."""
        mock_gpx = MagicMock(spec=gpxpy.gpx.GPX)
        mock_gpx.tracks = []

        result = load_trails_from_gpx_data(mock_gpx, source="test_source")

        assert result == []
