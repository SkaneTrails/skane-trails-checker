"""Unified Firestore database management tool.

Interactive and CLI modes for managing all Firestore collections:
trails, trail_details, places, foraging_spots, foraging_types, hike_groups.

Usage:
    uv run python dev-tools/db_manager.py                    # Interactive mode
    uv run python dev-tools/db_manager.py trails list        # CLI: list trails
    uv run python dev-tools/db_manager.py trails import --gpx-dir /path  # Import GPX files
    uv run python dev-tools/db_manager.py trails import --gpx-dir /path --duplicates replace
    uv run python dev-tools/db_manager.py places stats       # CLI: place stats
    uv run python dev-tools/db_manager.py status             # CLI: all collection counts

Environment:
    Requires .env file with Firestore credentials.
    Run `uv run python dev-tools/setup_env.py` first.
"""

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.functions.env_loader import load_env_if_needed

# Load environment variables before importing storage modules
load_env_if_needed()

from api.services.gpx_parser import parse_gpx_upload  # noqa: E402
from api.storage.firestore_client import get_collection  # noqa: E402
from api.storage.foraging_storage import get_foraging_spots, get_foraging_types  # noqa: E402
from api.storage.places_storage import get_all_places, get_places_by_category  # noqa: E402
from api.storage.trail_storage import (  # noqa: E402
    delete_trail,
    get_all_trails,
    get_sync_metadata,
    get_trail,
    save_trail,
    update_sync_metadata,
)

logger = logging.getLogger(__name__)


def _validate_environment() -> tuple[str, str]:
    """Validate required Firestore environment variables are set.

    Returns:
        Tuple of (project_id, database_id)

    Raises:
        SystemExit: If required env vars are missing
    """
    project_id = os.environ.get("FIRESTORE_PROJECT_ID", "")
    database_id = os.environ.get("FIRESTORE_DATABASE_ID", "")

    if not project_id or not database_id:
        missing = []
        if not project_id:
            missing.append("FIRESTORE_PROJECT_ID")
        if not database_id:
            missing.append("FIRESTORE_DATABASE_ID")

        print(f"\n❌ ERROR: Missing required environment variables: {', '.join(missing)}")
        print("\nThe DB manager needs Firestore credentials to connect.")
        print("Run this first to set up your .env file:\n")
        print("    uv run python dev-tools/setup_env.py\n")
        sys.exit(1)

    return project_id, database_id


# ── Display helpers ──────────────────────────────────────────────────────────


def _header(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def _row(label: str, value: object, indent: int = 2) -> None:
    print(f"{' ' * indent}{label}: {value}")


# ── Status command ───────────────────────────────────────────────────────────


def cmd_status(_args: argparse.Namespace) -> None:
    """Show counts for all Firestore collections."""
    _header("Database Status")

    collections = ["trails", "trail_details", "places", "foraging_spots", "foraging_types", "hike_groups"]
    for name in collections:
        count = sum(1 for _ in get_collection(name).stream())
        print(f"  {name}: {count}")

    sync = get_sync_metadata()
    print(f"\n  Sync metadata: {sync.count} trails, last modified: {sync.last_modified or 'never'}")


# ── Trails commands ──────────────────────────────────────────────────────────


def cmd_trails_list(args: argparse.Namespace) -> None:
    """List all trails with details."""
    source = getattr(args, "source", None)
    trails = get_all_trails(source=source)

    _header(f"Trails ({len(trails)} total)")

    for trail in trails:
        status_icon = "✅" if trail.status == "Explored!" else "🔲"
        length = f"{trail.length_km:.1f} km" if trail.length_km else "?"
        print(f"  {status_icon} {trail.name} [{trail.source}] — {length} ({trail.status})")


def cmd_trails_get(args: argparse.Namespace) -> None:
    """Show details for a specific trail."""
    trail = get_trail(args.trail_id)
    if not trail:
        print(f"  ❌ Trail not found: {args.trail_id}")
        return

    _header(f"Trail: {trail.name}")
    _row("ID", trail.trail_id)
    _row("Status", trail.status)
    _row("Source", trail.source)
    _row("Length", f"{trail.length_km:.1f} km" if trail.length_km else "unknown")
    _row("Difficulty", trail.difficulty or "unknown")
    _row("Activity date", trail.activity_date or "none")
    _row("Activity type", trail.activity_type or "none")
    _row("Duration", f"{trail.duration_minutes} min" if trail.duration_minutes else "none")
    if trail.elevation_gain is not None:
        _row("Elevation gain", f"+{trail.elevation_gain:.0f} m")
    if trail.elevation_loss is not None:
        _row("Elevation loss", f"-{trail.elevation_loss:.0f} m")
    if trail.avg_inclination_deg is not None:
        _row("Avg inclination", f"{trail.avg_inclination_deg}°")
    if trail.max_inclination_deg is not None:
        _row("Max inclination", f"{trail.max_inclination_deg}°")
    has_elev = any(c.elevation is not None for c in trail.coordinates_map) if trail.coordinates_map else False
    _row("Coordinates", f"{len(trail.coordinates_map)} points (elevation: {'yes' if has_elev else 'no'})")
    if trail.bounds:
        b = trail.bounds
        _row("Bounds", f"SW({b.south}, {b.west}) NE({b.north}, {b.east})")
    _row("Created", trail.created_at or "unknown")
    _row("Updated", trail.last_updated or "unknown")


def cmd_trails_search(args: argparse.Namespace) -> None:
    """Search trails by name (case-insensitive substring match)."""
    query = args.query.lower()
    trails = get_all_trails()
    matches = [t for t in trails if query in t.name.lower()]

    _header(f"Search: '{args.query}' ({len(matches)} matches)")

    for trail in matches:
        has_elev = any(c.elevation is not None for c in trail.coordinates_map) if trail.coordinates_map else False
        dur = f"{trail.duration_minutes}min" if trail.duration_minutes else "-"
        elev = "elev" if has_elev else "no-elev"
        print(
            f"  {trail.trail_id}  {trail.name} | {trail.length_km:.1f}km | {dur} | {elev} | {trail.activity_date or 'no date'}"
        )


def cmd_trails_stats(_args: argparse.Namespace) -> None:
    """Show trail statistics by source and status."""
    trails = get_all_trails()

    _header(f"Trail Statistics ({len(trails)} total)")

    by_source: dict[str, Counter] = {}
    for trail in trails:
        source = trail.source or "unknown"
        if source not in by_source:
            by_source[source] = Counter()
        by_source[source][trail.status] += 1

    for source, statuses in sorted(by_source.items()):
        total = sum(statuses.values())
        breakdown = ", ".join(f"{s}: {c}" for s, c in sorted(statuses.items()))
        print(f"  {source} ({total}): {breakdown}")

    total_km = sum(t.length_km for t in trails if t.length_km)
    explored = sum(1 for t in trails if t.status == "Explored!")
    print(f"\n  Total distance: {total_km:.1f} km")
    print(f"  Explored: {explored}/{len(trails)} ({explored * 100 // max(len(trails), 1)}%)")


# ── Places commands ──────────────────────────────────────────────────────────


def cmd_places_list(args: argparse.Namespace) -> None:
    """List all places, optionally filtered by category."""
    category = getattr(args, "category", None)
    places = get_places_by_category(category) if category else get_all_places()

    _header(f"Places ({len(places)} total)")

    limit = getattr(args, "limit", None) or len(places)
    for place in places[:limit]:
        cats = ", ".join(c.name for c in place.categories)
        city = f" — {place.city}" if place.city else ""
        print(f"  📍 {place.name} ({cats}){city}")

    if limit < len(places):
        print(f"\n  ... showing {limit} of {len(places)}")


def cmd_places_get(args: argparse.Namespace) -> None:
    """Show details for a specific place by ID."""
    places = get_all_places()
    match = next((p for p in places if p.place_id == args.place_id), None)
    if not match:
        print(f"  ❌ Place not found: {args.place_id}")
        return

    _header(f"Place: {match.name}")
    _row("ID", match.place_id)
    _row("Location", f"({match.lat:.4f}, {match.lng:.4f})")
    _row("Categories", ", ".join(f"{c.name} ({c.slug})" for c in match.categories))
    _row("Address", match.address or "—")
    _row("City", match.city or "—")
    _row("URL", match.weburl or "—")
    _row("Source", match.source)
    _row("Updated", match.last_updated or "unknown")


def cmd_places_stats(_args: argparse.Namespace) -> None:
    """Show place statistics by category."""
    places = get_all_places()

    _header(f"Place Statistics ({len(places)} total)")

    cat_counter: Counter = Counter()
    for place in places:
        for cat in place.categories:
            cat_counter[cat.slug] += 1

    for slug, count in cat_counter.most_common():
        from api.models.place import PLACE_CATEGORIES

        info = PLACE_CATEGORIES.get(slug, {})
        icon = info.get("icon", "📍")
        name = info.get("name", slug)
        print(f"  {icon} {name}: {count}")

    cities: Counter = Counter()
    for place in places:
        cities[place.city or "(no city)"] += 1
    print(f"\n  Unique cities: {len(cities)}")
    for city, count in cities.most_common(10):
        print(f"    {city}: {count}")


def cmd_places_search(args: argparse.Namespace) -> None:
    """Search places by name."""
    places = get_all_places()
    query = args.query.lower()
    matches = [p for p in places if query in p.name.lower()]

    _header(f"Search: '{args.query}' ({len(matches)} matches)")
    for place in matches:
        cats = ", ".join(c.name for c in place.categories)
        print(f"  📍 {place.name} ({cats}) — {place.city or 'no city'}")


# ── Foraging commands ────────────────────────────────────────────────────────


def cmd_foraging_list(args: argparse.Namespace) -> None:
    """List foraging spots."""
    month = getattr(args, "month", None)
    spots = get_foraging_spots(month=month)

    _header(f"Foraging Spots ({len(spots)} total)")

    for spot in spots:
        month_str = f" [{spot.month}]" if spot.month else ""
        notes = f" — {spot.notes}" if spot.notes else ""
        print(f"  🍄 {spot.type} ({spot.lat:.4f}, {spot.lng:.4f}){month_str}{notes}")


def cmd_foraging_types(_args: argparse.Namespace) -> None:
    """List all foraging types."""
    types = get_foraging_types()

    _header(f"Foraging Types ({len(types)} total)")

    for ft in types:
        print(f"  {ft.icon} {ft.name} — {ft.description or ''}")


def cmd_foraging_stats(_args: argparse.Namespace) -> None:
    """Show foraging statistics."""
    spots = get_foraging_spots()

    _header(f"Foraging Statistics ({len(spots)} total)")

    by_type: Counter = Counter()
    by_month: Counter = Counter()
    for spot in spots:
        by_type[spot.type] += 1
        if spot.month:
            by_month[spot.month] += 1

    print("  By type:")
    for t, count in by_type.most_common():
        print(f"    {t}: {count}")

    if by_month:
        print("\n  By month:")
        months_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for m in months_order:
            if m in by_month:
                print(f"    {m}: {by_month[m]}")


# ── Trails import command ─────────────────────────────────────────────────────


def _find_duplicate_by_date(activity_date: str, existing_trails: list, tolerance_minutes: int) -> object | None:
    """Find a duplicate trail by activity date within tolerance."""
    try:
        gpx_dt = datetime.fromisoformat(activity_date)
        if gpx_dt.tzinfo is None:
            gpx_dt = gpx_dt.replace(tzinfo=UTC)
    except (ValueError, TypeError):
        return None

    best_match = None
    best_delta = float("inf")
    for trail in existing_trails:
        if not trail.activity_date:
            continue
        try:
            trail_dt = datetime.fromisoformat(trail.activity_date)
            if trail_dt.tzinfo is None:
                trail_dt = trail_dt.replace(tzinfo=UTC)
            delta = abs((gpx_dt - trail_dt).total_seconds() / 60)
            if delta < best_delta:
                best_delta = delta
                best_match = trail
        except (ValueError, TypeError):
            continue

    if best_match and best_delta <= tolerance_minutes:
        return best_match
    return None


def _find_duplicate(
    trail_name: str, activity_date: str | None, existing_trails: list, tolerance_minutes: int = 60
) -> tuple[object | None, str]:
    """Find an existing trail that matches by date or name.

    Returns (matched_trail, match_method) where match_method is "date", "name",
    or "" if no match found.
    """
    if activity_date:
        match = _find_duplicate_by_date(activity_date, existing_trails, tolerance_minutes)
        if match:
            return match, "date"

    name_matches = [t for t in existing_trails if t.name == trail_name]
    if len(name_matches) == 1:
        return name_matches[0], "name"

    return None, ""


def _process_trail(trail: object, existing_trails: list, *, duplicates: str, dry_run: bool) -> tuple[str, list]:
    """Process a single trail for import. Returns (action, updated_trails).

    Action is one of: "imported", "replaced", "skipped".
    """
    duplicate, match_method = _find_duplicate(trail.name, trail.activity_date, existing_trails)

    if not duplicate:
        if dry_run:
            km = trail.length_km
            elev = "✓" if trail.elevation_gain is not None else "✗"
            dur = "✓" if trail.duration_minutes is not None else "✗"
            print(f"  📋 Would import: {trail.name} ({km:.1f} km, elev={elev}, dur={dur})")
        else:
            save_trail(trail, update_sync=False)
            existing_trails.append(trail)
            print(f"  ✅ Imported: {trail.name}")
        return "imported", existing_trails

    label = f"{trail.name} ↔ {duplicate.name} (via {match_method})"

    if duplicates == "skip":
        print(f"  ⏭️  Duplicate, skipped: {label}")
        return "skipped", existing_trails

    if duplicates == "replace":
        if not dry_run:
            delete_trail(duplicate.trail_id)
            save_trail(trail, update_sync=False)
            existing_trails = [t for t in existing_trails if t.trail_id != duplicate.trail_id]
            existing_trails.append(trail)
        print(f"  {'📋 Would replace' if dry_run else '🔄 Replaced'}: {label}")
        return "replaced", existing_trails

    # keep-both
    if not dry_run:
        save_trail(trail, update_sync=False)
        existing_trails.append(trail)
    print(f"  {'📋 Would keep both' if dry_run else '\u2795 Keeping both'}: {label}")
    return "imported", existing_trails


def cmd_trails_import(args: argparse.Namespace) -> None:
    """Import GPX files into Firestore as trails."""
    gpx_dir = Path(args.gpx_dir)
    source = getattr(args, "source", "other_trails") or "other_trails"
    dry_run = getattr(args, "dry_run", False)
    duplicates = getattr(args, "duplicates", "skip") or "skip"

    if not gpx_dir.is_dir():
        print(f"  ❌ GPX directory not found: {gpx_dir}")
        return

    _header("GPX Trail Import")
    print(f"  Source:     {source}")
    print(f"  Duplicates: {duplicates}")
    if dry_run:
        print("  ⚠️  DRY RUN — no changes will be written")
    print()

    existing_trails = get_all_trails()
    print(f"  {len(existing_trails)} existing trails in Firestore")

    gpx_files = sorted(gpx_dir.glob("*.gpx"))
    print(f"  {len(gpx_files)} GPX files in {gpx_dir}\n")

    counts = {"imported": 0, "replaced": 0, "skipped": 0, "errors": 0}

    for gpx_file in gpx_files:
        try:
            content = gpx_file.read_bytes()
            parsed_trails = parse_gpx_upload(content, source=source)
        except (ValueError, Exception) as e:
            counts["errors"] += 1
            print(f"  ❌ Parse error: {gpx_file.name} — {e}")
            continue

        for trail in parsed_trails:
            action, existing_trails = _process_trail(trail, existing_trails, duplicates=duplicates, dry_run=dry_run)
            counts[action] += 1

    if not dry_run and (counts["imported"] > 0 or counts["replaced"] > 0):
        update_sync_metadata()

    _header("Summary")
    _row("Imported", counts["imported"])
    _row("Replaced", counts["replaced"])
    _row("Skipped (duplicate)", counts["skipped"])
    _row("Skipped (parse error)", counts["errors"])
    _row("Total GPX files", len(gpx_files))


# ── Groups commands ──────────────────────────────────────────────────────────


def cmd_groups_list(_args: argparse.Namespace) -> None:
    """List all hike groups."""
    collection = get_collection("hike_groups")
    docs = list(collection.stream())

    _header(f"Hike Groups ({len(docs)} total)")

    for doc in docs:
        data = doc.to_dict()
        if not data:
            continue
        name = data.get("name", "unnamed")
        members = data.get("members", [])
        created_by = data.get("created_by", "unknown")
        print(f"  👥 {name} ({len(members)} members, created by: {created_by})")
        for member in members:
            role = member.get("role", "member")
            display = member.get("display_name") or member.get("uid", "?")
            print(f"      {role}: {display}")


# ── Interactive mode ─────────────────────────────────────────────────────────


MENU_ITEMS = [
    ("1", "Database status", cmd_status),
    ("2", "List trails", cmd_trails_list),
    ("3", "Trail statistics", cmd_trails_stats),
    ("4", "Search trails", cmd_trails_search),
    ("5", "List places", cmd_places_list),
    ("6", "Place statistics", cmd_places_stats),
    ("7", "Search places", cmd_places_search),
    ("8", "List foraging spots", cmd_foraging_list),
    ("9", "Foraging types", cmd_foraging_types),
    ("10", "Foraging statistics", cmd_foraging_stats),
    ("11", "List hike groups", cmd_groups_list),
    ("12", "Import GPX trails", cmd_trails_import),
    ("q", "Quit", None),
]


def _prompt_import_args() -> argparse.Namespace | None:
    """Prompt for GPX import arguments in interactive mode."""
    ns = argparse.Namespace()
    gpx_dir = input("  GPX directory: ").strip()
    if not gpx_dir:
        print("  ❌ Empty path")
        return None
    ns.gpx_dir = Path(gpx_dir)
    ns.source = input("  Source [other_trails]: ").strip() or "other_trails"
    dup = input("  Duplicates — skip/replace/keep-both [skip]: ").strip().lower() or "skip"
    if dup not in ("skip", "replace", "keep-both"):
        print("  ❌ Invalid choice")
        return None
    ns.duplicates = dup
    dry = input("  Dry run? [Y/n]: ").strip().lower()
    ns.dry_run = dry != "n"
    return ns


def _build_interactive_namespace(handler: object) -> argparse.Namespace | None:
    """Build a namespace with extra input for interactive commands."""
    if handler == cmd_trails_import:
        return _prompt_import_args()

    ns = argparse.Namespace()
    if handler == cmd_places_search:
        ns.query = input("  Search query: ").strip()
        if not ns.query:
            print("  ❌ Empty query")
            return None
    elif handler == cmd_trails_get:
        ns.trail_id = input("  Trail ID: ").strip()
    elif handler == cmd_trails_list:
        ns.source = None
    elif handler == cmd_trails_search:
        ns.query = input("  Search query: ").strip()
        if not ns.query:
            print("  \u274c Empty query")
            return None
    elif handler == cmd_places_list:
        ns.category = None
        ns.limit = 20
    elif handler == cmd_foraging_list:
        ns.month = None
    return ns


def _interactive() -> None:
    """Run interactive menu mode."""
    _header("Skåne Trails DB Manager")

    while True:
        print()
        for key, label, _ in MENU_ITEMS:
            print(f"  [{key}] {label}")

        choice = input("\n  Select: ").strip()
        if choice == "q":
            print("  Bye!")
            break

        handler = next((fn for key, _, fn in MENU_ITEMS if key == choice), None)
        if not handler:
            print("  ❌ Invalid choice")
            continue

        ns = _build_interactive_namespace(handler)
        if ns is None:
            continue
        handler(ns)


# ── CLI parser ───────────────────────────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Unified Firestore database management tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Run without arguments for interactive mode.",
    )
    sub = parser.add_subparsers(dest="command")

    # status
    sub.add_parser("status", help="Show all collection counts")

    # trails
    trails = sub.add_parser("trails", help="Trail operations")
    trails_sub = trails.add_subparsers(dest="trails_command")

    trails_list = trails_sub.add_parser("list", help="List trails")
    trails_list.add_argument("--source", help="Filter by source (planned_hikes, other_trails, world_wide_hikes)")

    trails_get = trails_sub.add_parser("get", help="Get trail details")
    trails_get.add_argument("trail_id", help="Trail ID")

    trails_sub.add_parser("stats", help="Trail statistics")

    trails_search = trails_sub.add_parser("search", help="Search trails by name")
    trails_search.add_argument("query", help="Search query (substring match)")

    trails_import = trails_sub.add_parser("import", help="Import GPX files into Firestore")
    trails_import.add_argument("--gpx-dir", required=True, type=Path, help="Directory containing GPX files")
    trails_import.add_argument("--source", default="other_trails", help="Trail source (other_trails, world_wide_hikes)")
    trails_import.add_argument(
        "--duplicates",
        choices=["skip", "replace", "keep-both"],
        default="skip",
        help="How to handle duplicates: skip (default), replace, or keep-both",
    )
    trails_import.add_argument("--dry-run", action="store_true", help="Show what would happen")

    # places
    places = sub.add_parser("places", help="Place operations")
    places_sub = places.add_subparsers(dest="places_command")

    places_list = places_sub.add_parser("list", help="List places")
    places_list.add_argument("--category", help="Filter by category slug")
    places_list.add_argument("--limit", type=int, help="Max results to show")

    places_get = places_sub.add_parser("get", help="Get place details")
    places_get.add_argument("place_id", help="Place ID")

    places_sub.add_parser("stats", help="Place statistics by category")

    places_search = places_sub.add_parser("search", help="Search places by name")
    places_search.add_argument("query", help="Search query")

    # foraging
    foraging = sub.add_parser("foraging", help="Foraging operations")
    foraging_sub = foraging.add_subparsers(dest="foraging_command")

    foraging_list = foraging_sub.add_parser("list", help="List foraging spots")
    foraging_list.add_argument("--month", help="Filter by month (Jan, Feb, ...)")

    foraging_sub.add_parser("types", help="List foraging types")
    foraging_sub.add_parser("stats", help="Foraging statistics")

    # groups
    groups = sub.add_parser("groups", help="Hike group operations")
    groups_sub = groups.add_subparsers(dest="groups_command")
    groups_sub.add_parser("list", help="List hike groups")

    return parser


_COMMAND_HANDLERS = {
    "trails": {
        "sub_attr": "trails_command",
        "handlers": {
            "list": cmd_trails_list,
            "get": cmd_trails_get,
            "stats": cmd_trails_stats,
            "search": cmd_trails_search,
            "import": cmd_trails_import,
        },
        "usage": "trails {list|get|stats|search|import}",
    },
    "places": {
        "sub_attr": "places_command",
        "handlers": {
            "list": cmd_places_list,
            "get": cmd_places_get,
            "stats": cmd_places_stats,
            "search": cmd_places_search,
        },
        "usage": "places {list|get|stats|search}",
    },
    "foraging": {
        "sub_attr": "foraging_command",
        "handlers": {"list": cmd_foraging_list, "types": cmd_foraging_types, "stats": cmd_foraging_stats},
        "usage": "foraging {list|types|stats}",
    },
    "groups": {"sub_attr": "groups_command", "handlers": {"list": cmd_groups_list}, "usage": "groups {list}"},
}


def _dispatch(args: argparse.Namespace) -> None:
    """Route parsed args to the correct command handler."""
    if args.command == "status":
        cmd_status(args)
        return

    config = _COMMAND_HANDLERS.get(args.command)
    if not config:
        return

    sub_command = getattr(args, config["sub_attr"], None)
    handler = config["handlers"].get(sub_command) if sub_command else None
    if handler:
        handler(args)
    else:
        print(f"Usage: db_manager.py {config['usage']}")


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    project_id, database_id = _validate_environment()
    print(f"\n  🔗 Connected to: {project_id} / {database_id}")

    if not args.command:
        _interactive()
    else:
        _dispatch(args)


if __name__ == "__main__":
    main()
