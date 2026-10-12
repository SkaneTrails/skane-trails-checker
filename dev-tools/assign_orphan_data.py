"""
Move app-created trails and foraging spots that have no group into the superusers' group.

Superusers used to save their uploads, recordings and foraging spots without a group, which made
those trails visible to every group. Compiled-in public trails have no group and no `created_by`,
so they are left alone. Nothing is deleted.

The target group is the one all superusers belong to (or pass --group-id). Every superuser must be
a member of a group: the API scopes superusers to their own group, so one without a group gets no data.

Usage:
    uv run python dev-tools/assign_orphan_data.py --dry-run
    uv run python dev-tools/assign_orphan_data.py
    uv run python dev-tools/assign_orphan_data.py --group-id <id>
"""

import argparse
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.absolute()))

from api.storage.firestore_client import create_batch, get_collection
from api.storage.hike_group_storage import get_hike_group, get_user_membership, list_superusers
from api.storage.sync_status import touch
from api.storage.trail_tombstones import add_tombstone
from app.functions.env_loader import load_env_if_needed

load_env_if_needed()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def resolve_group_id(group_id: str | None) -> str:
    """Return the explicit group, or the single group all superusers belong to."""
    groups: dict[str, str | None] = {}
    for email in list_superusers():
        membership = get_user_membership(email)
        groups[email] = membership.group_id if membership else None
    without_group = sorted(email for email, member_group in groups.items() if member_group is None)
    if without_group:
        msg = f"Superusers without a group would get no data from the API; add them to a group first: {without_group}"
        raise SystemExit(msg)

    if group_id:
        if get_hike_group(group_id) is None:
            msg = f"Group {group_id} does not exist"
            raise SystemExit(msg)
        return group_id

    distinct = set(groups.values())
    if len(distinct) != 1:
        msg = f"Superusers are not all in one group ({groups}); pass --group-id"
        raise SystemExit(msg)
    return distinct.pop()  # type: ignore[return-value]


def assign_trails(group_id: str, *, dry_run: bool) -> int:
    """Give trails created in the app without a group to `group_id`. Returns the count."""
    collection = get_collection("trails")
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    count = 0
    for doc in collection.where("group_id", "==", None).stream():
        data = doc.to_dict()
        if not data or not data.get("created_by"):
            continue
        count += 1
        logger.info("%sTrail %s (%s)", "[DRY RUN] " if dry_run else "", data.get("name", "?"), doc.id)
        if dry_run:
            continue
        batch = create_batch()
        batch.update(doc.reference, {"group_id": group_id, "modified_at": now, "last_updated": now})
        touch("trails", batch=batch)
        # Other groups could see it until now; the tombstone makes their clients drop it.
        if not data.get("is_public"):
            add_tombstone(batch, doc.id, data, now)
        batch.commit()
    return count


def assign_foraging_spots(group_id: str, *, dry_run: bool) -> int:
    """Give foraging spots created in the app without a group to `group_id`. Returns the count."""
    count = 0
    for doc in get_collection("foraging_spots").where("group_id", "==", None).stream():
        data = doc.to_dict()
        # Imported spots (dev-tools/import_foraging.py) have no created_by and are not app-created.
        if not data or not data.get("created_by"):
            continue
        count += 1
        logger.info("%sForaging spot %s", "[DRY RUN] " if dry_run else "", doc.id)
        if dry_run:
            continue
        batch = create_batch()
        batch.update(doc.reference, {"group_id": group_id})
        touch("foraging_spots", batch=batch)
        batch.commit()
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign group-less app-created data to the superusers' group")
    parser.add_argument("--group-id", help="Target group (default: the group all superusers belong to)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    group_id = resolve_group_id(args.group_id)
    logger.info("Target group: %s", group_id)
    trails = assign_trails(group_id, dry_run=args.dry_run)
    spots = assign_foraging_spots(group_id, dry_run=args.dry_run)
    logger.info("Trails: %d, foraging spots: %d%s", trails, spots, " (dry run)" if args.dry_run else "")


if __name__ == "__main__":
    main()
