"""Import foraging spots and types from CSV/JSON files to Firestore.

This script migrates existing foraging data from disk-based storage
(CSV for spots, JSON for types) to Firestore collections.

Usage:
    uv run python dev-tools/import_foraging.py           # Normal import
    uv run python dev-tools/import_foraging.py --dry-run # Preview without importing
    uv run python dev-tools/import_foraging.py --force   # Overwrite existing data
"""

import argparse
import csv
import json
import sys
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.storage.foraging_storage import get_foraging_spots, get_foraging_types, save_foraging_spot, save_foraging_type
from app.functions.env_loader import load_env_if_needed

# Load environment variables
load_env_if_needed()

# File paths
APP_DIR = Path(__file__).parent.parent / "app"
CSV_PATH = APP_DIR / "foraging_data" / "foraging_data.csv"
JSON_PATH = APP_DIR / "foraging_data" / "foraging_types.json"

# Constants
COORDINATE_TOLERANCE = 0.0001  # ~11 meters at the equator


def import_foraging_types(*, dry_run: bool = False, force: bool = False) -> tuple[int, int]:
    """Import foraging types from JSON file to Firestore.

    Args:
        dry_run: Preview without importing
        force: Overwrite existing types

    Returns:
        Tuple of (imported_count, skipped_count)
    """
    if not JSON_PATH.exists():
        print(f"❌ Foraging types file not found: {JSON_PATH}")
        return 0, 0

    print(f"\n📋 Loading foraging types from {JSON_PATH.name}...")
    with JSON_PATH.open(encoding="utf-8") as f:
        types_from_file = json.load(f)

    print(f"   Found {len(types_from_file)} types in file")

    # Check existing types in Firestore
    existing_types = {t.name: t for t in get_foraging_types()} if not force else {}
    print(f"   Found {len(existing_types)} types in Firestore")

    imported = 0
    skipped = 0

    for type_name, type_data in types_from_file.items():
        if type_name in existing_types and not force:
            print(f"   ⏭️  Skipping {type_data['icon']} {type_name} (already exists)")
            skipped += 1
            continue

        if dry_run:
            print(f"   🔍 Would import: {type_data['icon']} {type_name}")
            imported += 1
        else:
            print(f"   ✅ Importing: {type_data['icon']} {type_name}")
            save_foraging_type(type_name, type_data)
            imported += 1

    return imported, skipped


def import_foraging_spots(*, dry_run: bool = False, force: bool = False) -> tuple[int, int]:
    """Import foraging spots from CSV file to Firestore.

    Args:
        dry_run: Preview without importing
        force: Overwrite existing spots (deletes all first)

    Returns:
        Tuple of (imported_count, skipped_count)
    """
    if not CSV_PATH.exists():
        print(f"❌ Foraging data file not found: {CSV_PATH}")
        return 0, 0

    print(f"\n📍 Loading foraging spots from {CSV_PATH.name}...")

    spots_from_file = []
    with CSV_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse CSV row to foraging spot format
            spot = {
                "type": row["type"],
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "notes": row.get("notes", ""),
                "month": row["month"],
                "date": row.get("date", ""),
            }
            spots_from_file.append(spot)

    print(f"   Found {len(spots_from_file)} spots in file")

    # Check existing spots
    existing_spots = get_foraging_spots() if not force else []
    print(f"   Found {len(existing_spots)} spots in Firestore")

    if force and existing_spots and not dry_run:
        print("   ⚠️  Force mode: existing spots will be overwritten")

    imported = 0
    skipped = 0

    for spot in spots_from_file:
        # Check if spot already exists (same type, lat, lng, month)
        exists = any(
            existing.type == spot["type"]
            and abs(existing.lat - spot["lat"]) < COORDINATE_TOLERANCE
            and abs(existing.lng - spot["lng"]) < COORDINATE_TOLERANCE
            and existing.month == spot["month"]
            for existing in existing_spots
        )

        if exists and not force:
            print(
                f"   ⏭️  Skipping {spot['type']} at ({spot['lat']:.4f}, {spot['lng']:.4f}) - {spot['month']} (already exists)"
            )
            skipped += 1
            continue

        if dry_run:
            print(f"   🔍 Would import: {spot['type']} at ({spot['lat']:.4f}, {spot['lng']:.4f}) - {spot['month']}")
            imported += 1
        else:
            print(f"   ✅ Importing: {spot['type']} at ({spot['lat']:.4f}, {spot['lng']:.4f}) - {spot['month']}")
            save_foraging_spot(spot)
            imported += 1

    return imported, skipped


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import foraging data from CSV/JSON to Firestore",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run python dev-tools/import_foraging.py           # Import new data
  uv run python dev-tools/import_foraging.py --dry-run # Preview without importing
  uv run python dev-tools/import_foraging.py --force   # Overwrite existing data
        """,
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview import without saving to Firestore")
    parser.add_argument("--force", action="store_true", help="Overwrite existing data in Firestore")
    args = parser.parse_args()

    print("=" * 60)
    print("📥 Foraging Data Import Tool")
    print("=" * 60)

    if args.dry_run:
        print("🔍 DRY RUN MODE: No data will be saved to Firestore")
    if args.force:
        print("⚠️  FORCE MODE: Existing data will be overwritten")

    # Import types first (spots reference types)
    types_imported, types_skipped = import_foraging_types(dry_run=args.dry_run, force=args.force)

    # Import spots
    spots_imported, spots_skipped = import_foraging_spots(dry_run=args.dry_run, force=args.force)

    # Summary
    print("\n" + "=" * 60)
    print("📊 Import Summary")
    print("=" * 60)
    print("Foraging Types:")
    print(f"  ✅ Imported: {types_imported}")
    print(f"  ⏭️  Skipped:  {types_skipped}")
    print("\nForaging Spots:")
    print(f"  ✅ Imported: {spots_imported}")
    print(f"  ⏭️  Skipped:  {spots_skipped}")

    if args.dry_run:
        print("\n💡 Run without --dry-run to actually import the data")
    elif types_imported > 0 or spots_imported > 0:
        print("\n🎉 Import complete!")
    else:
        print("\n✨ All data already in Firestore - nothing to import")


if __name__ == "__main__":
    main()
