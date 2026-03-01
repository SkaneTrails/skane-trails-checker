"""Firestore admin tool for trail data management.

Usage:
    uv run python dev-tools/trail_manager.py --project <project_id> fix-statuses

Commands:
    fix-statuses    Set all non-Skåneleden trails to 'Explored!'

Note: --project is required. Reads and writes trails in the skane-trails-db database.
"""

import argparse
from collections import defaultdict

from google.cloud import firestore

DATABASE = "skane-trails-db"
TRAILS_COLLECTION = "trails"

_project: str = ""


def get_db() -> firestore.Client:
    """Get Firestore client for the configured GCP project."""
    return firestore.Client(project=_project, database=DATABASE)


def fix_statuses() -> None:
    """Set all non-planned_hikes trails to 'Explored!'.

    Skåneleden (source=planned_hikes) stays as 'To Explore'.
    All other sources are set to 'Explored!'.
    """
    db = get_db()
    collection = db.collection(TRAILS_COLLECTION)

    # Show current state
    by_source: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for doc in collection.stream():
        data = doc.to_dict()
        by_source[data.get("source", "unknown")][data.get("status", "unknown")] += 1

    print("Current trail statuses:")
    for source, statuses in sorted(by_source.items()):
        counts = ", ".join(f"{s}: {c}" for s, c in sorted(statuses.items()))
        print(f"  {source}: {counts}")

    # Fix non-planned_hikes trails that are "To Explore"
    updated = 0
    for source in ("other_trails", "world_wide_hikes"):
        docs = (
            collection.where(filter=firestore.FieldFilter("source", "==", source))
            .where(filter=firestore.FieldFilter("status", "==", "To Explore"))
            .stream()
        )
        for doc in docs:
            doc.reference.update({"status": "Explored!"})
            updated += 1
            if updated % 10 == 0:
                print(f"  Updated {updated} trails...")

    print(f"\nDone. Updated {updated} trails to 'Explored!'")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Firestore admin tool for trail data")
    parser.add_argument("--project", required=True, help="GCP project ID")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("fix-statuses", help="Set all non-Skåneleden trails to 'Explored!'")

    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    global _project  # noqa: PLW0603
    _project = args.project

    commands = {"fix-statuses": fix_statuses}

    if not args.command:
        parser.print_help()
        return

    commands[args.command]()


if __name__ == "__main__":
    main()
