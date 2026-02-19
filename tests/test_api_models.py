"""Tests for trail Pydantic models."""

import pytest
from pydantic import ValidationError

from api.models.trail import (
    Coordinate,
    TrailBounds,
    TrailDetailsResponse,
    TrailFilterParams,
    TrailResponse,
    TrailUpdate,
)


class TestCoordinate:
    def test_create_coordinate(self):
        coord = Coordinate(lat=56.0, lng=13.5)
        assert coord.lat == 56.0
        assert coord.lng == 13.5

    def test_coordinate_serialization(self):
        coord = Coordinate(lat=56.0, lng=13.5)
        data = coord.model_dump()
        assert data == {"lat": 56.0, "lng": 13.5}


class TestTrailBounds:
    def test_create_bounds(self):
        bounds = TrailBounds(north=57.0, south=55.0, east=14.0, west=12.0)
        assert bounds.north == 57.0
        assert bounds.south == 55.0


class TestTrailResponse:
    def test_create_trail_response(self):
        trail = TrailResponse(
            trail_id="abc123",
            name="Test Trail",
            difficulty="Easy",
            length_km=5.5,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)],
            bounds=TrailBounds(north=56.1, south=56.0, east=13.1, west=13.0),
            center=Coordinate(lat=56.05, lng=13.05),
            source="planned_hikes",
            last_updated="2026-01-01T00:00:00",
        )
        assert trail.trail_id == "abc123"
        assert trail.name == "Test Trail"
        assert len(trail.coordinates_map) == 2
        assert trail.activity_date is None
        assert trail.elevation_gain is None

    def test_trail_response_with_optional_fields(self):
        trail = TrailResponse(
            trail_id="abc123",
            name="Hiked Trail",
            difficulty="Medium",
            length_km=12.3,
            status="Explored!",
            coordinates_map=[],
            bounds=TrailBounds(north=57.0, south=55.0, east=14.0, west=12.0),
            center=Coordinate(lat=56.0, lng=13.0),
            source="other_trails",
            last_updated="2026-01-15T10:30:00",
            activity_date="2026-01-15",
            activity_type="hiking",
            elevation_gain=350.5,
            elevation_loss=280.2,
        )
        assert trail.activity_date == "2026-01-15"
        assert trail.elevation_gain == 350.5

    def test_trail_response_serialization_roundtrip(self):
        trail = TrailResponse(
            trail_id="xyz789",
            name="Roundtrip Trail",
            difficulty="Unknown",
            length_km=3.0,
            status="To Explore",
            coordinates_map=[Coordinate(lat=56.0, lng=13.0)],
            bounds=TrailBounds(north=56.0, south=56.0, east=13.0, west=13.0),
            center=Coordinate(lat=56.0, lng=13.0),
            source="world_wide_hikes",
            last_updated="2026-02-01T00:00:00",
        )
        data = trail.model_dump()
        restored = TrailResponse(**data)
        assert restored == trail


class TestTrailDetailsResponse:
    def test_create_trail_details(self):
        details = TrailDetailsResponse(
            trail_id="abc123", coordinates_full=[Coordinate(lat=56.0, lng=13.0), Coordinate(lat=56.1, lng=13.1)]
        )
        assert details.trail_id == "abc123"
        assert len(details.coordinates_full) == 2
        assert details.elevation_profile is None

    def test_trail_details_with_elevation(self):
        details = TrailDetailsResponse(
            trail_id="abc123",
            coordinates_full=[Coordinate(lat=56.0, lng=13.0)],
            elevation_profile=[100.0, 120.0, 115.0],
        )
        assert details.elevation_profile == [100.0, 120.0, 115.0]


class TestTrailUpdate:
    def test_valid_name_update(self):
        update = TrailUpdate(name="New Name")
        assert update.name == "New Name"
        assert update.status is None

    def test_valid_status_update(self):
        update = TrailUpdate(status="Explored!")
        assert update.status == "Explored!"

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError, match="String should match pattern"):
            TrailUpdate(status="Invalid Status")

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError, match="String should have at least 1 character"):
            TrailUpdate(name="")

    def test_exclude_none_on_dump(self):
        update = TrailUpdate(name="Updated")
        data = update.model_dump(exclude_none=True)
        assert data == {"name": "Updated"}
        assert "status" not in data


class TestTrailFilterParams:
    def test_all_none_by_default(self):
        params = TrailFilterParams()
        assert params.source is None
        assert params.search is None

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError, match="String should match pattern"):
            TrailFilterParams(status="Walking")
