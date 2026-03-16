"""
Migrate Firestore data to role-based auth with group-scoped access.

This script:
1. Creates a hike group (e.g. "Hemmestorp")
2. Adds specified emails as admin members
3. Sets group_id on existing trails (non-bootstrapped only)
4. Sets group_id on existing foraging spots

Bootstrapped trails (source=planned_hikes) keep group_id=None (public).

Usage:
    uv run python dev-tools/migrate_auth.py --group-name Hemmestorp --admins user@example.com
    uv run python dev-tools/migrate_auth.py --group-name Hemmestorp --admins user1@example.com user2@example.com
    uv run python dev-tools/migrate_auth.py --group-name Hemmestorp --admins user@example.com --dry-run
"""

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.absolute()))

from api.storage.firestore_client import get_collection
from api.storage.hike_group_storage import add_member, get_all_hike_groups, save_hike_group
from app.functions.env_loader import load_env_if_needed

load_env_if_needed()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

PUBLIC_SOURCES = {"planned_hikes"}


def find_or_create_group(name: str, admin_email: str, *, dry_run: bool) -> str | None:
    """Find existing group by name or create a new one."""
    existing = get_all_hike_groups()
    for group in existing:
        if group.name == name:
            logger.info("Group '%s' already exists (id=%s)", name, group.group_id)
            return group.group_id

    if dry_run:
        logger.info("[DRY RUN] Would create group '%s'", name)
        return None

    group_id = save_hike_group(name, created_by=admin_email)
    logger.info("Created group '%s' (id=%s)", name, group_id)
    return group_id


def add_admin_members(group_id: str, admin_emails: list[str], *, dry_run: bool) -> None:
    """Add admin members to the group."""
    for email in admin_emails:
        if dry_run:
            logger.info("[DRY RUN] Would add admin: %s", email)
            continue
        add_member(email=email, group_id=group_id, role="admin", invited_by="migration")
        logger.info("Added admin: %s", email)


def migrate_trails(group_id: str, *, dry_run: bool) -> tuple[int, int]:
    """Set group_id on non-public trails. Returns (updated, skipped) counts."""
    collection = get_collection("trails")
    updated = 0
    skipped = 0

    for doc in collection.stream():
        data = doc.to_dict()
        if not data:
            continue

        source = data.get("source", "")
        existing_group_id = data.get("group_id")

        if source in PUBLIC_SOURCES:
            skipped += 1
            continue

        if existing_group_id == group_id:
            skipped += 1
            continue

        if dry_run:
            logger.info("[DRY RUN] Would set group_id on trail: %s (%s)", data.get("name", "?"), doc.id)
            updated += 1
            continue

        collection.document(doc.id).update({"group_id": group_id})
        updated += 1

    return updated, skipped


def migrate_foraging_spots(group_id: str, *, dry_run: bool) -> tuple[int, int]:
    """Set group_id on all foraging spots. Returns (updated, skipped) counts."""
    collection = get_collection("foraging_spots")
    updated = 0
    skipped = 0

    for doc in collection.stream():
        data = doc.to_dict()
        if not data:
            continue

        existing_group_id = data.get("group_id")
        if existing_group_id == group_id:
            skipped += 1
            continue

        if dry_run:
            logger.info("[DRY RUN] Would set group_id on spot: %s", doc.id)
            updated += 1
            continue

        collection.document(doc.id).update({"group_id": group_id})
        updated += 1

    return updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Firestore data to role-based auth")
    parser.add_argument("--group-name", required=True, help="Name of the hike group to create")
    parser.add_argument("--admins", nargs="+", required=True, help="Admin email addresses")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    if args.dry_run:
        logger.info("=== DRY RUN MODE ===")

    group_id = find_or_create_group(args.group_name, args.admins[0], dry_run=args.dry_run)

    if group_id:
        add_admin_members(group_id, args.admins, dry_run=args.dry_run)

        trails_updated, trails_skipped = migrate_trails(group_id, dry_run=args.dry_run)
        logger.info("Trails: %d updated, %d skipped", trails_updated, trails_skipped)

        spots_updated, spots_skipped = migrate_foraging_spots(group_id, dry_run=args.dry_run)
        logger.info("Foraging spots: %d updated, %d skipped", spots_updated, spots_skipped)
    elif args.dry_run:
        logger.info("[DRY RUN] Would add admins: %s", ", ".join(args.admins))
        logger.info("[DRY RUN] Would then migrate trails and foraging spots")

    logger.info("Migration %s", "preview complete" if args.dry_run else "complete")


if __name__ == "__main__":
    main()
