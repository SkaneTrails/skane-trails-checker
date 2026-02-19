"""Tests for trail storage layer (doc-to-model conversion)."""

from api.storage.trail_storage import _doc_to_trail, _doc_to_trail_details


class TestDocToTrail:
    def test_full_document(self):
        data = {
            "trail_id": "abc123",
            "name": "Skåneleden SL1",
            "difficulty": "Medium",
            "length_km": 12.5,
            "status": "To Explore",
            "coordinates_map": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.1, "lng": 13.1}],
            "bounds": {"north": 56.1, "south": 56.0, "east": 13.1, "west": 13.0},
            "center": {"lat": 56.05, "lng": 13.05},
            "source": "planned_hikes",
            "last_updated": "2026-01-01T00:00:00",
            "activity_date": "2026-01-01",
            "activity_type": "hiking",
            "elevation_gain": 250.0,
            "elevation_loss": 200.0,
        }
        trail = _doc_to_trail(data)
        assert trail.trail_id == "abc123"
        assert trail.name == "Skåneleden SL1"
        assert trail.difficulty == "Medium"
        assert trail.length_km == 12.5
        assert trail.status == "To Explore"
        assert len(trail.coordinates_map) == 2
        assert trail.coordinates_map[0].lat == 56.0
        assert trail.bounds.north == 56.1
        assert trail.center.lat == 56.05
        assert trail.source == "planned_hikes"
        assert trail.activity_date == "2026-01-01"
        assert trail.elevation_gain == 250.0

    def test_minimal_document_with_defaults(self):
        data = {"trail_id": "min123", "name": "Minimal"}
        trail = _doc_to_trail(data)
        assert trail.trail_id == "min123"
        assert trail.difficulty == "Unknown"
        assert trail.length_km == 0.0
        assert trail.status == "To Explore"
        assert trail.coordinates_map == []
        assert trail.bounds.north == 0.0
        assert trail.center.lat == 0.0
        assert trail.source == ""
        assert trail.activity_date is None
        assert trail.elevation_gain is None

    def test_document_missing_optional_fields(self):
        data = {
            "trail_id": "opt123",
            "name": "No optionals",
            "coordinates_map": [{"lat": 56.0, "lng": 13.0}],
            "bounds": {"north": 56.0, "south": 56.0, "east": 13.0, "west": 13.0},
            "center": {"lat": 56.0, "lng": 13.0},
            "source": "other_trails",
            "last_updated": "2026-02-01T00:00:00",
        }
        trail = _doc_to_trail(data)
        assert trail.activity_date is None
        assert trail.activity_type is None
        assert trail.elevation_gain is None
        assert trail.elevation_loss is None


class TestDocToTrailDetails:
    def test_full_document(self):
        data = {
            "trail_id": "abc123",
            "coordinates_full": [{"lat": 56.0, "lng": 13.0}, {"lat": 56.05, "lng": 13.05}, {"lat": 56.1, "lng": 13.1}],
            "elevation_profile": [100.0, 150.0, 120.0],
            "waypoints": [{"name": "Start", "lat": 56.0, "lng": 13.0}],
            "statistics": {"avg_speed": 4.5},
        }
        details = _doc_to_trail_details(data)
        assert details.trail_id == "abc123"
        assert len(details.coordinates_full) == 3
        assert details.elevation_profile == [100.0, 150.0, 120.0]
        assert details.waypoints[0]["name"] == "Start"

    def test_minimal_document(self):
        data = {"trail_id": "min456", "coordinates_full": []}
        details = _doc_to_trail_details(data)
        assert details.trail_id == "min456"
        assert details.coordinates_full == []
        assert details.elevation_profile is None
        assert details.waypoints is None
