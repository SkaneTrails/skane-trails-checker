"""Tests for recording processor — GPS coordinate to trail conversion."""

import pytest

from api.models.trail import RecordingCoordinate
from api.services.recording_processor import (
    _compute_elevation_metrics,
    _haversine_km,
    _simplify_coordinates,
    process_recording,
)


def _make_coords(points: list[tuple[float, float, float | None, int]]) -> list[RecordingCoordinate]:
    """Create RecordingCoordinate list from (lat, lng, altitude, timestamp_ms) tuples."""
    return [RecordingCoordinate(lat=lat, lng=lng, altitude=alt, timestamp=ts) for lat, lng, alt, ts in points]


class TestHaversineKm:
    def test_same_point_returns_zero(self):
        assert _haversine_km(55.0, 13.0, 55.0, 13.0) == 0.0

    def test_known_distance(self):
        # ~1 degree latitude ≈ 111 km
        dist = _haversine_km(55.0, 13.0, 56.0, 13.0)
        assert 110.0 < dist < 112.0

    def test_longitude_distance_varies_with_latitude(self):
        # Longitude distance shorter at higher latitudes due to cos factor
        dist_equator = _haversine_km(0.0, 0.0, 0.0, 1.0)
        dist_sweden = _haversine_km(55.0, 13.0, 55.0, 14.0)
        assert dist_equator > dist_sweden


class TestElevationMetrics:
    def test_flat_terrain(self):
        coords = [(55.0, 13.0), (55.001, 13.0), (55.002, 13.0)]
        elevations = [100.0, 100.0, 100.0]
        gain, loss, avg_incl, max_incl = _compute_elevation_metrics(coords, elevations)
        assert gain == 0.0
        assert loss == 0.0
        # No inclination on flat terrain (horiz_dist > 1m but elev_diff = 0)
        assert avg_incl == 0.0
        assert max_incl == 0.0

    def test_uphill(self):
        coords = [(55.0, 13.0), (55.001, 13.0)]
        elevations = [100.0, 150.0]
        gain, loss, _, _ = _compute_elevation_metrics(coords, elevations)
        assert gain == 50.0
        assert loss == 0.0

    def test_downhill(self):
        coords = [(55.0, 13.0), (55.001, 13.0)]
        elevations = [150.0, 100.0]
        gain, loss, _, _ = _compute_elevation_metrics(coords, elevations)
        assert gain == 0.0
        assert loss == 50.0

    def test_mixed_terrain(self):
        coords = [(55.0, 13.0), (55.001, 13.0), (55.002, 13.0)]
        elevations = [100.0, 200.0, 150.0]
        gain, loss, _, _ = _compute_elevation_metrics(coords, elevations)
        assert gain == 100.0
        assert loss == 50.0

    def test_inclination_calculated(self):
        coords = [(55.0, 13.0), (55.001, 13.0)]
        elevations = [100.0, 200.0]
        _, _, avg_incl, max_incl = _compute_elevation_metrics(coords, elevations)
        assert avg_incl is not None
        assert max_incl is not None
        assert avg_incl > 0
        assert max_incl > 0


class TestSimplifyCoordinates:
    def test_short_list_unchanged(self):
        coords = [(55.0, 13.0), (55.1, 13.1)]
        result = _simplify_coordinates(coords)
        assert result == coords

    def test_single_point_unchanged(self):
        coords = [(55.0, 13.0)]
        result = _simplify_coordinates(coords)
        assert result == coords

    def test_reduces_point_count(self):
        # Create a straight line with many points — RDP should simplify to just endpoints
        coords = [(55.0 + i * 0.001, 13.0) for i in range(100)]
        result = _simplify_coordinates(coords, tolerance=0.001)
        assert len(result) < len(coords)
        # Should keep at least first and last
        assert result[0] == coords[0]
        assert result[-1] == coords[-1]

    def test_preserves_3d_coordinates(self):
        coords = [(55.0, 13.0, 100.0), (55.001, 13.0, 110.0), (55.1, 13.0, 200.0)]
        result = _simplify_coordinates(coords)
        assert all(len(c) == 3 for c in result)


class TestProcessRecording:
    def _sample_coords(self) -> list[RecordingCoordinate]:
        """Create a simple north-south trail with elevation data."""
        base_time = 1700000000000  # ms
        return _make_coords(
            [
                (55.600, 13.000, 50.0, base_time),
                (55.601, 13.000, 55.0, base_time + 30_000),
                (55.602, 13.000, 60.0, base_time + 60_000),
                (55.603, 13.000, 55.0, base_time + 90_000),
                (55.604, 13.000, 50.0, base_time + 120_000),
            ]
        )

    def test_returns_trail_and_details(self):
        trail, details = process_recording("Test Hike", self._sample_coords(), "gps_recording", "user-1")
        assert trail.trail_id
        assert trail.name == "Test Hike"
        assert details.trail_id == trail.trail_id

    def test_trail_marked_explored(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.status == "Explored!"

    def test_source_preserved(self):
        trail, _ = process_recording("Test", self._sample_coords(), "other_trails", "user-1")
        assert trail.source == "other_trails"

    def test_length_calculated(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.length_km > 0
        # 4 points with 0.001° lat difference ≈ 0.111 km each ≈ 0.44 km total
        assert 0.3 < trail.length_km < 0.6

    def test_bounds_calculated(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.bounds.south == pytest.approx(55.600)
        assert trail.bounds.north == pytest.approx(55.604)

    def test_center_calculated(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.center.lat == pytest.approx(55.602, abs=0.001)
        assert trail.center.lng == pytest.approx(13.000, abs=0.001)

    def test_elevation_metrics(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.elevation_gain is not None
        assert trail.elevation_loss is not None
        assert trail.elevation_gain > 0
        assert trail.elevation_loss > 0

    def test_duration_from_timestamps(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        # 120000 ms = 2 minutes
        assert trail.duration_minutes == 2

    def test_activity_date_from_first_timestamp(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.activity_date is not None

    def test_activity_type_is_hiking(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.activity_type == "hiking"

    def test_created_by_set(self):
        trail, _ = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert trail.created_by == "user-1"

    def test_details_has_full_coordinates(self):
        coords = self._sample_coords()
        _, details = process_recording("Test", coords, "gps_recording", "user-1")
        assert len(details.coordinates_full) == len(coords)

    def test_details_has_elevation_profile(self):
        _, details = process_recording("Test", self._sample_coords(), "gps_recording", "user-1")
        assert details.elevation_profile is not None
        assert len(details.elevation_profile) == 5

    def test_no_elevation_when_missing(self):
        base_time = 1700000000000
        coords = _make_coords(
            [
                (55.600, 13.000, None, base_time),
                (55.601, 13.000, None, base_time + 60_000),
                (55.602, 13.000, None, base_time + 120_000),
            ]
        )
        trail, details = process_recording("Test", coords, "gps_recording", "user-1")
        assert trail.elevation_gain is None
        assert trail.elevation_loss is None
        assert details.elevation_profile is None

    def test_stable_trail_id(self):
        coords = self._sample_coords()
        trail1, _ = process_recording("Test", coords, "gps_recording", "user-1")
        trail2, _ = process_recording("Test", coords, "gps_recording", "user-2")
        assert trail1.trail_id == trail2.trail_id  # Same name + coords = same ID

    def test_different_names_yield_different_ids(self):
        coords = self._sample_coords()
        trail1, _ = process_recording("Hike A", coords, "gps_recording", "user-1")
        trail2, _ = process_recording("Hike B", coords, "gps_recording", "user-1")
        assert trail1.trail_id != trail2.trail_id

    def test_coordinates_map_simplified(self):
        # Create a long trail with many points
        base_time = 1700000000000
        coords = _make_coords([(55.0 + i * 0.0001, 13.0, 100.0, base_time + i * 5000) for i in range(500)])
        trail, details = process_recording("Long", coords, "gps_recording", "user-1")
        # Simplified should be shorter than full
        assert len(trail.coordinates_map) < len(details.coordinates_full)
        assert len(details.coordinates_full) == 500

    def test_zero_duration_not_stored(self):
        """Zero duration from identical timestamps should be None."""
        coords = _make_coords([(55.600, 13.000, 50.0, 1700000000000), (55.601, 13.000, 55.0, 1700000000000)])
        trail, _ = process_recording("Test", coords, "gps_recording", "user-1")
        assert trail.duration_minutes is None
