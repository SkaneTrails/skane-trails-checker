"""Tests for foraging and place Pydantic models."""

import pytest
from pydantic import ValidationError

from api.models.foraging import (
    ForagingSpotCreate,
    ForagingSpotResponse,
    ForagingSpotUpdate,
    ForagingTypeCreate,
    ForagingTypeResponse,
)
from api.models.place import PLACE_CATEGORIES, PlaceCategoryResponse, PlaceResponse


class TestForagingSpotResponse:
    def test_create_spot_response(self):
        spot = ForagingSpotResponse(id="doc1", type="Mushrooms", lat=56.0, lng=13.5, month="Sep")
        assert spot.id == "doc1"
        assert spot.type == "Mushrooms"
        assert spot.notes == ""

    def test_spot_response_serialization(self):
        spot = ForagingSpotResponse(
            id="doc1",
            type="Blueberries",
            lat=56.1,
            lng=13.2,
            notes="Great patch",
            month="Jul",
            date="2026-07-15",
            created_at="2026-07-15T10:00:00",
            last_updated="2026-07-15T10:00:00",
        )
        data = spot.model_dump()
        assert data["type"] == "Blueberries"
        assert data["notes"] == "Great patch"


class TestForagingSpotCreate:
    def test_valid_spot_create(self):
        spot = ForagingSpotCreate(type="Mushrooms", lat=56.0, lng=13.5, month="Sep")
        assert spot.type == "Mushrooms"

    def test_invalid_month_rejected(self):
        with pytest.raises(ValidationError, match="String should"):
            ForagingSpotCreate(type="Mushrooms", lat=56.0, lng=13.5, month="September")

    def test_invalid_lat_rejected(self):
        with pytest.raises(ValidationError, match="greater than or equal to -90"):
            ForagingSpotCreate(type="Mushrooms", lat=-91.0, lng=13.5, month="Sep")

    def test_invalid_lng_rejected(self):
        with pytest.raises(ValidationError, match="less than or equal to 180"):
            ForagingSpotCreate(type="Mushrooms", lat=56.0, lng=181.0, month="Sep")

    def test_empty_type_rejected(self):
        with pytest.raises(ValidationError, match="String should have at least 1 character"):
            ForagingSpotCreate(type="", lat=56.0, lng=13.5, month="Sep")

    def test_all_months_accepted(self):
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for month in months:
            spot = ForagingSpotCreate(type="Test", lat=0.0, lng=0.0, month=month)
            assert spot.month == month


class TestForagingSpotUpdate:
    def test_partial_update(self):
        update = ForagingSpotUpdate(notes="Updated notes")
        data = update.model_dump(exclude_none=True)
        assert data == {"notes": "Updated notes"}

    def test_all_none_by_default(self):
        update = ForagingSpotUpdate()
        data = update.model_dump(exclude_none=True)
        assert data == {}


class TestForagingTypeResponse:
    def test_create_type_response(self):
        ft = ForagingTypeResponse(name="Blueberries", icon="🫐", color="#0000FF")
        assert ft.name == "Blueberries"
        assert ft.icon == "🫐"


class TestForagingTypeCreate:
    def test_valid_type_create(self):
        ft = ForagingTypeCreate(name="Mushrooms", icon="🍄")
        assert ft.name == "Mushrooms"
        assert ft.color == ""

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError, match="String should have at least 1 character"):
            ForagingTypeCreate(name="", icon="🍄")

    def test_empty_icon_rejected(self):
        with pytest.raises(ValidationError, match="String should have at least 1 character"):
            ForagingTypeCreate(name="Test", icon="")


class TestPlaceResponse:
    def test_create_place_response(self):
        place = PlaceResponse(
            place_id="p1",
            name="Parking Lot",
            lat=56.0,
            lng=13.5,
            categories=[PlaceCategoryResponse(name="Parkering", slug="parkering", icon="🅿️")],
        )
        assert place.place_id == "p1"
        assert len(place.categories) == 1

    def test_place_response_defaults(self):
        place = PlaceResponse(place_id="p2", name="Test", lat=0.0, lng=0.0)
        assert place.categories == []
        assert place.address == ""
        assert place.source == "skaneleden"


class TestPlaceCategories:
    def test_all_categories_have_name_and_icon(self):
        for slug, info in PLACE_CATEGORIES.items():
            assert "name" in info, f"Category '{slug}' missing 'name'"
            assert "icon" in info, f"Category '{slug}' missing 'icon'"

    def test_expected_category_count(self):
        assert len(PLACE_CATEGORIES) == 14
