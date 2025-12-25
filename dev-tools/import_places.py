"""Import places/POIs from Skåneleden API to Firestore.

This script fetches all places from the Skåneleden API and imports them
into Firestore for use in the Streamlit app. By default, places are
upserted (created or replaced if they already exist).

Usage:
    uv run python dev-tools/import_places.py           # Normal import (upsert)
    uv run python dev-tools/import_places.py --dry-run # Preview without importing
    uv run python dev-tools/import_places.py --clean   # Delete all before import
    uv run python dev-tools/import_places.py --filter  # Only import POI categories

Environment Variables:
    SKANELEDEN_API_TOKEN: API token for Skåneleden (required)
"""

import argparse
import os
import sys
from collections import Counter
from pathlib import Path

import requests

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.functions.env_loader import load_env_if_needed
from app.functions.place_models import PLACE_CATEGORIES, Place, PlaceCategory
from app.functions.places_storage import delete_all_places, get_place_count, save_places_batch

# Load environment variables
load_env_if_needed()

# Skåneleden API configuration
API_BASE_URL = "https://www.skaneleden.se/api"


def get_api_token() -> str:
    """Get API token from environment variable."""
    token = os.environ.get("SKANELEDEN_API_TOKEN")
    if not token:
        msg = "SKANELEDEN_API_TOKEN environment variable is required. Add it to your .env file."
        raise ValueError(msg)
    return token


HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# POI categories to filter (hiking-relevant)
POI_CATEGORY_SLUGS = [
    "parkering",
    "vatten",
    "lagerplats-med-vindskydd",
    "toalett",
    "kollektivtrafik",
    "boende",
    "badplats",
]

# Constants
MAX_PLACES_SAFETY_LIMIT = 5000
HTTP_OK = 200


def fetch_all_places() -> list[dict]:
    """Fetch all places from Skåneleden API using pagination.

    Returns:
        List of raw place dictionaries from API
    """
    print("🌐 Fetching places from Skåneleden API...")
    api_token = get_api_token()
    all_places = {}
    offset = 0
    limit = 50

    while offset < MAX_PLACES_SAFETY_LIMIT:
        url = f"{API_BASE_URL}/v2/places?token={api_token}&limit={limit}&offset={offset}"
        response = requests.get(url, headers=HEADERS, timeout=30)

        if response.status_code != HTTP_OK:
            print(f"❌ Error at offset {offset}: {response.status_code}")
            break

        items = response.json().get("data", {}).get("items", [])
        if not items:
            print(f"✓ No more items at offset {offset}")
            break

        for item in items:
            place_id = item.get("id")
            if place_id:
                all_places[place_id] = item

        offset += limit
        if offset % 200 == 0:
            print(f"   Fetched {len(all_places)} places...")

    print(f"✓ Total places fetched: {len(all_places)}")
    return list(all_places.values())


def convert_to_place(raw_place: dict) -> Place | None:
    """Convert raw API data to Place model.

    Args:
        raw_place: Dictionary from Skåneleden API

    Returns:
        Place object or None if invalid
    """
    place_id = raw_place.get("id")
    name = raw_place.get("name", "")
    lat = raw_place.get("lat")
    lng = raw_place.get("lng")

    if not place_id or not lat or not lng:
        return None

    # Convert categories
    raw_categories = raw_place.get("placeCategory", [])
    categories = []
    for raw_cat in raw_categories:
        cat_slug = raw_cat.get("slug", "")
        cat_name = raw_cat.get("name", "")

        # Use our display mapping if available
        display = PLACE_CATEGORIES.get(cat_slug, {})
        categories.append(
            PlaceCategory(name=display.get("name") or cat_name, slug=cat_slug, icon=display.get("icon") or "📍")
        )

    return Place(
        place_id=place_id,
        name=name,
        lat=float(lat),
        lng=float(lng),
        categories=categories,
        address=raw_place.get("address", ""),
        city=raw_place.get("city", ""),
        weburl=raw_place.get("weburl", ""),
        source="skaneleden",
    )


def filter_poi_places(places: list[Place]) -> list[Place]:
    """Filter places to only include hiking-relevant POI categories.

    Args:
        places: List of all places

    Returns:
        Filtered list with only POI categories
    """
    return [place for place in places if any(slug in POI_CATEGORY_SLUGS for slug in place.category_slugs)]


def print_category_summary(places: list[Place]) -> None:
    """Print summary of places by category."""
    cat_counts: Counter[str] = Counter()
    for place in places:
        for cat in place.categories:
            cat_counts[f"{cat.icon} {cat.name}"] += 1

    print("\n📊 Places by category:")
    for cat_display, count in cat_counts.most_common():
        print(f"   {cat_display}: {count}")


def import_places(*, dry_run: bool = False, clean: bool = False, filter_poi: bool = False) -> tuple[int, int]:
    """Import places from Skåneleden API to Firestore.

    Places are upserted (created or replaced) by default. Existing places
    with matching IDs will be updated with the latest data from the API.

    Args:
        dry_run: Preview without importing
        clean: Delete ALL existing places before import (fresh start)
        filter_poi: Only import POI categories (parkering, vatten, vindskydd, etc.)

    Returns:
        Tuple of (imported_count, skipped_count)
    """
    # Fetch from API
    raw_places = fetch_all_places()
    print(f"\n📋 Converting {len(raw_places)} places...")

    # Convert to Place objects
    places = []
    for raw in raw_places:
        place = convert_to_place(raw)
        if place:
            places.append(place)

    print(f"✓ Converted {len(places)} valid places")

    # Filter if requested
    if filter_poi:
        places = filter_poi_places(places)
        print(f"✓ Filtered to {len(places)} POI places")

    print_category_summary(places)

    # Check existing data
    existing_count = 0
    if not dry_run:
        existing_count = get_place_count()
        print(f"\n📊 Existing places in Firestore: {existing_count}")

    if dry_run:
        print(f"\n🔍 DRY RUN: Would import {len(places)} places")
        return len(places), 0

    # Delete all existing if clean mode
    if clean and existing_count > 0:
        print(f"\n🗑️  Deleting {existing_count} existing places (clean mode)...")
        delete_all_places()

    # Import to Firestore (upsert - creates or replaces)
    action = "Importing" if existing_count == 0 else "Upserting"
    print(f"\n📤 {action} {len(places)} places to Firestore...")
    saved = save_places_batch(places)

    print(f"\n✅ Import complete: {saved} places imported/updated")
    return saved, 0


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Import places from Skåneleden API to Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")
    parser.add_argument("--clean", action="store_true", help="Delete ALL existing data before import (fresh start)")
    parser.add_argument("--filter", action="store_true", help="Only import POI categories")

    args = parser.parse_args()

    print("=" * 60)
    print("SKÅNELEDEN PLACES IMPORTER")
    print("=" * 60)

    imported, skipped = import_places(dry_run=args.dry_run, clean=args.clean, filter_poi=args.filter)

    print("\n" + "=" * 60)
    print(f"SUMMARY: {imported} imported, {skipped} skipped")
    print("=" * 60)


if __name__ == "__main__":
    main()
