"""One-off cleanup for GPS spike outliers in already-stored trails.

The live recording pipeline rejects implausible GPS jumps using per-point
timestamps (see api/services/recording_processor._filter_speed_outliers).
Trails saved *before* that filter existed, or recorded by older clients, keep
their spikes. Those stored trails no longer have per-point timestamps, so this
tool uses a geometry-only heuristic instead: drop a point whose distance from
the last accepted point is both large in absolute terms and far above the
median step for that trail (the signature of an isolated "jump-and-return"
spike). Derived fields (coordinates_map, bounds, center, length, elevation
metrics) are recomputed from the cleaned track.

Dry-run by default. Pass --apply to write changes to Firestore.

Examples:
    uv run python dev-tools/clean_trail_outliers.py --name "Sodergard"
    uv run python dev-tools/clean_trail_outliers.py --trail-id 4f7711232059 --apply
    uv run python dev-tools/clean_trail_outliers.py --all-recorded
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.models.trail import Coordinate, TrailBounds, TrailDetailsResponse, TrailResponse
from api.services.recording_processor import _compute_elevation_metrics, _haversine_km, _simplify_coordinates
from api.storage.trail_storage import get_all_trails, get_trail, get_trail_details, save_trail, save_trail_details
from app.functions.env_loader import load_env_if_needed

load_env_if_needed()

DEFAULT_ABS_MIN_M = 80.0
DEFAULT_FACTOR = 6.0
_MIN_POINTS = 3


def _dist_m(a: Coordinate, b: Coordinate) -> float:
    return _haversine_km(a.lat, a.lng, b.lat, b.lng) * 1000.0


def clean_outliers(coords: list[Coordinate], abs_min_m: float, factor: float) -> tuple[list[Coordinate], list[int]]:
    """Return (cleaned_coords, dropped_indices) using a geometry-only heuristic.

    A point is dropped only when it is an *isolated* jump-and-return spike: its
    distance from the last accepted point exceeds both ``abs_min_m`` and
    ``factor`` times the median consecutive step, **and** the following point
    returns within that threshold of the anchor. A sustained far segment (e.g. a
    recording resumed after a gap) is kept as a new anchor instead of deleted.
    Falls back to the original list if cleaning would leave fewer than two points.
    """
    if len(coords) < _MIN_POINTS:
        return coords, []

    steps = sorted(_dist_m(coords[i - 1], coords[i]) for i in range(1, len(coords)))
    median_step = steps[len(steps) // 2]
    threshold = max(abs_min_m, factor * median_step)

    accepted: list[Coordinate] = [coords[0]]
    dropped: list[int] = []
    for i in range(1, len(coords)):
        anchor = accepted[-1]
        if _dist_m(anchor, coords[i]) > threshold:
            # Only treat a far point as an isolated spike when the track returns
            # near the anchor at the next point. A sustained far segment (e.g. a
            # resumed recording after a gap) is kept as a new anchor instead.
            nxt = coords[i + 1] if i + 1 < len(coords) else None
            if nxt is not None and _dist_m(anchor, nxt) <= threshold:
                dropped.append(i)
                continue
        accepted.append(coords[i])

    if len(accepted) < 2:  # noqa: PLR2004
        return coords, []
    return accepted, dropped


def _recompute(trail: TrailResponse, details: TrailDetailsResponse, cleaned: list[Coordinate]) -> None:
    """Rewrite derived fields on trail/details in place from the cleaned track."""
    lats = [c.lat for c in cleaned]
    lngs = [c.lng for c in cleaned]
    has_elev = all(c.elevation is not None for c in cleaned)

    coords_3d: list[tuple[float, ...]]
    if has_elev:
        coords_3d = [(c.lat, c.lng, c.elevation) for c in cleaned if c.elevation is not None]
    else:
        coords_3d = [(c.lat, c.lng) for c in cleaned]
    simplified = _simplify_coordinates(coords_3d)

    length_km = sum(
        _haversine_km(cleaned[i].lat, cleaned[i].lng, cleaned[i + 1].lat, cleaned[i + 1].lng)
        for i in range(len(cleaned) - 1)
    )

    trail.bounds = TrailBounds(north=max(lats), south=min(lats), east=max(lngs), west=min(lngs))
    trail.center = Coordinate(lat=sum(lats) / len(lats), lng=sum(lngs) / len(lngs))
    trail.length_km = round(length_km, 2)

    if has_elev:
        trail.coordinates_map = [Coordinate(lat=la, lng=ln, elevation=el) for la, ln, el in simplified]
        elevations = [c.elevation for c in cleaned if c.elevation is not None]
        details.elevation_profile = elevations
        if len(elevations) > 1:
            (trail.elevation_gain, trail.elevation_loss, trail.avg_inclination_deg, trail.max_inclination_deg) = (
                _compute_elevation_metrics([(c.lat, c.lng) for c in cleaned], elevations)
            )
    else:
        trail.coordinates_map = [Coordinate(lat=la, lng=ln) for la, ln in simplified]
        # No complete elevation series: drop metrics that would otherwise be stale.
        trail.elevation_gain = None
        trail.elevation_loss = None
        trail.avg_inclination_deg = None
        trail.max_inclination_deg = None
        details.elevation_profile = None

    details.coordinates_full = cleaned


def _resolve_targets(args: argparse.Namespace) -> list[TrailResponse]:
    if args.trail_id:
        trail = get_trail(args.trail_id)
        if not trail:
            print(f"No trail with id {args.trail_id}")
            return []
        return [trail]
    trails = get_all_trails()
    if args.name:
        needle = args.name.lower()
        return [t for t in trails if needle in t.name.lower()]
    if args.all_recorded:
        return [t for t in trails if t.created_by]
    return []


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean GPS spike outliers from stored trails.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--trail-id", help="Clean a single trail by id.")
    group.add_argument("--name", help="Clean all trails whose name contains this substring.")
    group.add_argument("--all-recorded", action="store_true", help="Clean every user-recorded trail.")
    parser.add_argument("--abs-min", type=float, default=DEFAULT_ABS_MIN_M, help="Minimum jump (m) to consider.")
    parser.add_argument("--factor", type=float, default=DEFAULT_FACTOR, help="Multiple of median step to flag.")
    parser.add_argument("--apply", action="store_true", help="Persist changes (otherwise dry-run).")
    args = parser.parse_args()

    targets = _resolve_targets(args)
    if not targets:
        print("No matching trails.")
        return

    print(f"{'APPLYING' if args.apply else 'DRY-RUN'} over {len(targets)} trail(s)\n")
    for trail in targets:
        details = get_trail_details(trail.trail_id)
        if not details or not details.coordinates_full:
            print(f"- {trail.name} ({trail.trail_id}): no coordinates, skipped")
            continue
        before = details.coordinates_full
        cleaned, dropped = clean_outliers(before, args.abs_min, args.factor)
        print(f"- {trail.name} ({trail.trail_id}): {len(before)} -> {len(cleaned)} points, dropped {len(dropped)}")
        if not dropped:
            continue
        print(f"    dropped indices: {dropped}")
        if args.apply:
            _recompute(trail, details, cleaned)
            save_trail_details(details)
            save_trail(trail)
            print("    saved.")

    if not args.apply:
        print("\nDry-run only. Re-run with --apply to persist.")


if __name__ == "__main__":
    main()
