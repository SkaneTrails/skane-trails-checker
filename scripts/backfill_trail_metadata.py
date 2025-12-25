#!/usr/bin/env python3
"""
Backfill metadata (date, elevation) for existing trails in Firestore.

This script:
1. Loads all trails from Firestore
2. For each trail, finds matching GPX file in tracks_gpx/ directories
3. Extracts metadata (activity_date, activity_type, elevation_gain, elevation_loss)
4. Updates Firestore with the metadata

Usage:
    uv run python scripts/backfill_trail_metadata.py
"""

import logging
import sys
from pathlib import Path

import gpxpy

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.absolute()))

from app.functions.env_loader import load_env_if_needed
from app.functions.trail_storage import get_all_trails, update_trail

# Load environment
load_env_if_needed()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def extract_metadata_from_gpx(gpx_file_path: Path) -> dict:  # noqa: C901, PLR0912
    """Extract metadata from a GPX file.

    Args:
        gpx_file_path: Path to GPX file

    Returns:
        Dict with metadata: activity_date, activity_type, elevation_gain, elevation_loss
    """
    metadata = {}

    try:
        with gpx_file_path.open(encoding="utf-8") as gpx_file:
            gpx_data = gpxpy.parse(gpx_file)

            # Extract date from GPX metadata
            if gpx_data.time:
                metadata["activity_date"] = gpx_data.time.isoformat()

            # Extract activity type if present
            for track in gpx_data.tracks:
                if track.type:
                    metadata["activity_type"] = track.type
                    break

            # Calculate elevation gain/loss
            total_gain = 0.0
            total_loss = 0.0

            for track in gpx_data.tracks:
                for segment in track.segments:
                    prev_elevation = None
                    for point in segment.points:
                        if point.elevation is not None:
                            if prev_elevation is not None:
                                diff = point.elevation - prev_elevation
                                if diff > 0:
                                    total_gain += diff
                                else:
                                    total_loss += abs(diff)
                            prev_elevation = point.elevation

            if total_gain > 0:
                metadata["elevation_gain"] = round(total_gain, 1)
            if total_loss > 0:
                metadata["elevation_loss"] = round(total_loss, 1)

    except Exception as e:
        logger.warning("Failed to extract metadata from %s: %s", gpx_file_path, e)

    return metadata


def find_gpx_file(trail_name: str, trail_source: str, gpx_directories: dict[str, Path]) -> Path | None:
    """Find GPX file matching the trail name.

    Args:
        trail_name: Name of the trail
        trail_source: Source of the trail (planned_hikes, other_trails, world_wide_hikes)
        gpx_directories: Dict mapping source to directory path

    Returns:
        Path to GPX file or None if not found
    """
    # Get directory for this source
    gpx_dir = gpx_directories.get(trail_source)
    if not gpx_dir or not gpx_dir.exists():
        return None

    # Search for matching GPX file
    # Try exact match first
    for gpx_file in gpx_dir.glob("*.gpx"):
        # Parse GPX to check track names
        try:
            with gpx_file.open(encoding="utf-8") as f:
                gpx_data = gpxpy.parse(f)
                for track in gpx_data.tracks:
                    if track.name == trail_name:
                        return gpx_file
        except Exception as e:
            logger.debug("Failed to parse %s: %s", gpx_file, e)
            continue

    return None


def main() -> None:  # noqa: C901, PLR0912, PLR0915
    """Backfill metadata for all trails."""
    logger.info("Starting trail metadata backfill...")

    # Define GPX directories
    app_dir = Path(__file__).parent.parent / "app"
    gpx_directories = {
        "planned_hikes": app_dir / "tracks_gpx" / "planned_hikes",
        "other_trails": app_dir / "tracks_gpx" / "other_trails",
        "world_wide_hikes": app_dir / "tracks_gpx" / "world_wide_hikes",
    }

    # Verify directories exist
    for path in gpx_directories.values():
        if not path.exists():
            logger.warning("Directory not found: %s", path)

    # Load all trails
    logger.info("Loading trails from Firestore...")
    trails = get_all_trails()
    logger.info("Found %d trails", len(trails))

    # Track statistics
    updated_count = 0
    skipped_count = 0
    not_found_count = 0

    # Process each trail
    for trail in trails:
        # Skip if trail already has metadata
        if trail.activity_date and trail.elevation_gain is not None:
            logger.debug("Skipping %s - already has metadata", trail.name)
            skipped_count += 1
            continue

        # Find matching GPX file
        gpx_file = find_gpx_file(trail.name, trail.source, gpx_directories)

        if not gpx_file:
            logger.warning("GPX file not found for trail: %s (source: %s)", trail.name, trail.source)
            not_found_count += 1
            continue

        # Extract metadata
        logger.info("Processing %s from %s...", trail.name, gpx_file.name)
        metadata = extract_metadata_from_gpx(gpx_file)

        if not metadata:
            logger.warning("No metadata extracted for %s", trail.name)
            continue

        # Update trail in Firestore
        try:
            # Build update dict with only fields that have values
            update_data = {}
            if "activity_date" in metadata:
                update_data["activity_date"] = metadata["activity_date"]
            if "activity_type" in metadata:
                update_data["activity_type"] = metadata["activity_type"]
            if "elevation_gain" in metadata:
                update_data["elevation_gain"] = metadata["elevation_gain"]
            if "elevation_loss" in metadata:
                update_data["elevation_loss"] = metadata["elevation_loss"]

            if update_data:
                update_trail(trail.trail_id, update_data)
                logger.info("✓ Updated %s with: %s", trail.name, ", ".join(update_data.keys()))
                updated_count += 1
            else:
                logger.warning("No metadata to update for %s", trail.name)

        except Exception:
            logger.exception("Failed to update %s", trail.name)

    # Summary
    logger.info("\n%s", "=" * 60)
    logger.info("Backfill complete!")
    logger.info("  Updated: %d", updated_count)
    logger.info("  Skipped (already had metadata): %d", skipped_count)
    logger.info("  Not found (no GPX file): %d", not_found_count)
    logger.info("  Total trails: %d", len(trails))
    logger.info("%s", "=" * 60)


if __name__ == "__main__":
    main()
