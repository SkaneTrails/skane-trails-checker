"""Tests for place data models."""

from app.functions.place_models import PLACE_CATEGORIES, Place, PlaceCategory, get_category_display


class TestPlaceCategory:
    """Tests for PlaceCategory model."""

    def test_creation(self) -> None:
        """Test PlaceCategory creation with all fields."""
        category = PlaceCategory(name="Parkering", slug="parkering", icon="🅿️")

        assert category.name == "Parkering"
        assert category.slug == "parkering"
        assert category.icon == "🅿️"

    def test_creation_without_icon(self) -> None:
        """Test PlaceCategory defaults empty icon if not provided."""
        category = PlaceCategory(name="Test", slug="test")

        assert category.name == "Test"
        assert category.slug == "test"
        assert category.icon == ""

    def test_to_dict(self) -> None:
        """Test PlaceCategory serialization to dictionary."""
        category = PlaceCategory(name="Vatten", slug="vatten", icon="💧")

        result = category.to_dict()

        assert result == {"name": "Vatten", "slug": "vatten", "icon": "💧"}

    def test_from_dict(self) -> None:
        """Test PlaceCategory deserialization from dictionary."""
        data = {"name": "Vindskydd", "slug": "lagerplats-med-vindskydd", "icon": "⛺"}

        category = PlaceCategory.from_dict(data)

        assert category.name == "Vindskydd"
        assert category.slug == "lagerplats-med-vindskydd"
        assert category.icon == "⛺"

    def test_from_dict_with_missing_fields(self) -> None:
        """Test PlaceCategory handles missing fields with defaults."""
        data = {"name": "Test", "slug": "test"}

        category = PlaceCategory.from_dict(data)

        assert category.name == "Test"
        assert category.slug == "test"
        assert category.icon == ""

    def test_roundtrip_serialization(self) -> None:
        """Test PlaceCategory can be serialized and deserialized."""
        original = PlaceCategory(name="Badplats", slug="badplats", icon="🏊")

        data = original.to_dict()
        restored = PlaceCategory.from_dict(data)

        assert restored.name == original.name
        assert restored.slug == original.slug
        assert restored.icon == original.icon


class TestPlace:
    """Tests for Place model."""

    def test_creation_with_required_fields(self) -> None:
        """Test Place creation with only required fields."""
        place = Place(place_id="place-1", name="Test Place", lat=55.6050, lng=13.0038)

        assert place.place_id == "place-1"
        assert place.name == "Test Place"
        assert place.lat == 55.6050
        assert place.lng == 13.0038
        assert place.categories == []
        assert place.address == ""
        assert place.city == ""
        assert place.weburl == ""
        assert place.source == "skaneleden"
        assert place.last_updated == ""

    def test_creation_with_all_fields(self) -> None:
        """Test Place creation with all fields."""
        categories = [PlaceCategory(name="Parkering", slug="parkering", icon="🅿️")]

        place = Place(
            place_id="place-2",
            name="Complete Place",
            lat=55.7,
            lng=13.2,
            categories=categories,
            address="Test Address 123",
            city="Malmö",
            weburl="https://example.com",
            source="custom",
            last_updated="2025-12-26",
        )

        assert place.place_id == "place-2"
        assert place.name == "Complete Place"
        assert place.lat == 55.7
        assert place.lng == 13.2
        assert len(place.categories) == 1
        assert place.categories[0].name == "Parkering"
        assert place.address == "Test Address 123"
        assert place.city == "Malmö"
        assert place.weburl == "https://example.com"
        assert place.source == "custom"
        assert place.last_updated == "2025-12-26"

    def test_to_dict(self) -> None:
        """Test Place serialization to dictionary."""
        categories = [
            PlaceCategory(name="Vatten", slug="vatten", icon="💧"),
            PlaceCategory(name="Toalett", slug="toalett", icon="🚻"),
        ]

        place = Place(
            place_id="place-3", name="Trail Head", lat=56.0, lng=14.0, categories=categories, city="Kristianstad"
        )

        result = place.to_dict()

        assert result["place_id"] == "place-3"
        assert result["name"] == "Trail Head"
        assert result["lat"] == 56.0
        assert result["lng"] == 14.0
        assert len(result["categories"]) == 2
        assert result["categories"][0] == {"name": "Vatten", "slug": "vatten", "icon": "💧"}
        assert result["categories"][1] == {"name": "Toalett", "slug": "toalett", "icon": "🚻"}
        assert result["city"] == "Kristianstad"
        assert result["address"] == ""
        assert result["weburl"] == ""
        assert result["source"] == "skaneleden"

    def test_from_dict(self) -> None:
        """Test Place deserialization from dictionary."""
        data = {
            "place_id": "place-4",
            "name": "Mountain Hut",
            "lat": 56.5,
            "lng": 13.5,
            "categories": [
                {"name": "Boende", "slug": "boende", "icon": "🏠"},
                {"name": "Vindskydd", "slug": "lagerplats-med-vindskydd", "icon": "⛺"},
            ],
            "address": "Mountain Road 1",
            "city": "Helsingborg",
            "weburl": "https://hut.example.com",
            "source": "custom",
            "last_updated": "2025-12-25",
        }

        place = Place.from_dict(data)

        assert place.place_id == "place-4"
        assert place.name == "Mountain Hut"
        assert place.lat == 56.5
        assert place.lng == 13.5
        assert len(place.categories) == 2
        assert place.categories[0].name == "Boende"
        assert place.categories[1].slug == "lagerplats-med-vindskydd"
        assert place.address == "Mountain Road 1"
        assert place.city == "Helsingborg"
        assert place.weburl == "https://hut.example.com"
        assert place.source == "custom"
        assert place.last_updated == "2025-12-25"

    def test_from_dict_with_missing_optional_fields(self) -> None:
        """Test Place handles missing optional fields with defaults."""
        data = {"place_id": "place-5", "name": "Minimal Place", "lat": 55.0, "lng": 13.0}

        place = Place.from_dict(data)

        assert place.place_id == "place-5"
        assert place.name == "Minimal Place"
        assert place.categories == []
        assert place.address == ""
        assert place.city == ""
        assert place.weburl == ""
        assert place.source == "skaneleden"
        assert place.last_updated == ""

    def test_roundtrip_serialization(self) -> None:
        """Test Place can be serialized and deserialized."""
        categories = [PlaceCategory(name="Parkering", slug="parkering", icon="🅿️")]
        original = Place(
            place_id="place-6",
            name="Test Place",
            lat=55.6,
            lng=13.1,
            categories=categories,
            address="Test St 1",
            city="Lund",
        )

        data = original.to_dict()
        restored = Place.from_dict(data)

        assert restored.place_id == original.place_id
        assert restored.name == original.name
        assert restored.lat == original.lat
        assert restored.lng == original.lng
        assert len(restored.categories) == len(original.categories)
        assert restored.categories[0].name == original.categories[0].name
        assert restored.address == original.address
        assert restored.city == original.city

    def test_category_slugs_property(self) -> None:
        """Test category_slugs property returns list of slugs."""
        categories = [
            PlaceCategory(name="Vatten", slug="vatten", icon="💧"),
            PlaceCategory(name="Parkering", slug="parkering", icon="🅿️"),
            PlaceCategory(name="Toalett", slug="toalett", icon="🚻"),
        ]

        place = Place(place_id="place-7", name="Test", lat=55.0, lng=13.0, categories=categories)

        slugs = place.category_slugs

        assert slugs == ["vatten", "parkering", "toalett"]

    def test_category_slugs_empty_when_no_categories(self) -> None:
        """Test category_slugs returns empty list when no categories."""
        place = Place(place_id="place-8", name="Test", lat=55.0, lng=13.0)

        assert place.category_slugs == []

    def test_category_names_property(self) -> None:
        """Test category_names property returns list of names."""
        categories = [
            PlaceCategory(name="Vatten", slug="vatten", icon="💧"),
            PlaceCategory(name="Parkering", slug="parkering", icon="🅿️"),
        ]

        place = Place(place_id="place-9", name="Test", lat=55.0, lng=13.0, categories=categories)

        names = place.category_names

        assert names == ["Vatten", "Parkering"]

    def test_category_names_empty_when_no_categories(self) -> None:
        """Test category_names returns empty list when no categories."""
        place = Place(place_id="place-10", name="Test", lat=55.0, lng=13.0)

        assert place.category_names == []


class TestGetCategoryDisplay:
    """Tests for get_category_display function."""

    def test_returns_known_category(self) -> None:
        """Test get_category_display returns correct data for known category."""
        result = get_category_display("parkering")

        assert result == {"name": "Parkering", "icon": "🅿️"}

    def test_returns_vatten_category(self) -> None:
        """Test get_category_display for water category."""
        result = get_category_display("vatten")

        assert result == {"name": "Vatten", "icon": "💧"}

    def test_returns_toalett_category(self) -> None:
        """Test get_category_display for toilet category."""
        result = get_category_display("toalett")

        assert result == {"name": "Toalett", "icon": "🚻"}

    def test_returns_default_for_unknown_category(self) -> None:
        """Test get_category_display returns formatted default for unknown slug."""
        result = get_category_display("unknown-category")

        assert result["name"] == "Unknown Category"
        assert result["icon"] == "📍"

    def test_formats_unknown_slug_with_spaces(self) -> None:
        """Test unknown slug is formatted with spaces and title case."""
        result = get_category_display("my-custom-category")

        assert result["name"] == "My Custom Category"
        assert result["icon"] == "📍"


class TestPlaceCategoriesConstant:
    """Tests for PLACE_CATEGORIES constant."""

    def test_contains_expected_categories(self) -> None:
        """Test PLACE_CATEGORIES has all expected categories."""
        expected_slugs = [
            "parkering",
            "vatten",
            "lagerplats-med-vindskydd",
            "toalett",
            "kollektivtrafik",
            "boende",
            "badplats",
            "ata-dricka",
            "livsmedelgardsbutik",
            "sevardhet",
            "aktivitet",
            "turistinformation",
            "konst",
            "naturlekplats",
        ]

        for slug in expected_slugs:
            assert slug in PLACE_CATEGORIES

    def test_all_categories_have_name_and_icon(self) -> None:
        """Test all categories have required name and icon fields."""
        for data in PLACE_CATEGORIES.values():
            assert "name" in data
            assert "icon" in data
            assert isinstance(data["name"], str)
            assert isinstance(data["icon"], str)
            assert len(data["name"]) > 0
            assert len(data["icon"]) > 0
