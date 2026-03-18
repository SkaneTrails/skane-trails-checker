"""Shared GPX processing pipeline: merge, simplify, and import to Firestore.

This module provides reusable building blocks for trail import scripts.
Each trail source (Skåneleden, Sentiero Italia, etc.) provides its own
download logic and produces a list of TrailFile dicts. The pipeline then
handles the common merge → simplify → import workflow.

Usage:
    from gpx_pipeline import merge_gpx_files, simplify_gpx, import_gpx_to_firestore

    files = [{"gpx_path": Path("a.gpx"), "name": "Trail A"}, ...]
    merged = merge_gpx_files(files, output_path)
    simplify_gpx(merged)
    import_gpx_to_firestore(merged, source="world_wide_hikes", project="my-proj")
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

import gpxpy
import gpxpy.gpx
from rdp import rdp

if TYPE_CHECKING:
    from collections.abc import Callable

    from api.models.trail import TrailResponse

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

RDP_TOLERANCE = 0.00005
MIN_POINTS_FOR_RDP = 3


class TrailPostProcessor(Protocol):
    """Optional callback to enrich a trail after GPX conversion."""

    def __call__(self, trail: TrailResponse, track: gpxpy.gpx.GPXTrack) -> None: ...


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------


def merge_gpx_files(files: list[dict[str, Any]], output_path: Path) -> Path:
    """Merge individual GPX files into a single combined file.

    Each entry in *files* must have:
        - gpx_path (Path): path to the GPX file on disk
        - name (str): display name for the track

    Returns the path to the merged GPX file.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    combined = gpxpy.gpx.GPX()

    success = 0
    fail = 0

    for entry in files:
        gpx_path: Path = entry["gpx_path"]
        name: str = entry["name"]

        if not gpx_path.exists():
            print(f"  X {name} — file not found: {gpx_path}")
            fail += 1
            continue

        try:
            with gpx_path.open(encoding="utf-8") as f:
                gpx_obj = gpxpy.parse(f)

            has_data = False

            for track in gpx_obj.tracks:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = name
                new_track.description = track.description
                for segment in track.segments:
                    new_track.segments.append(segment)
                combined.tracks.append(new_track)
                has_data = True

            # Convert routes to tracks (some GPX files use routes instead)
            for route in gpx_obj.routes:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = name
                segment = gpxpy.gpx.GPXTrackSegment()
                for point in route.points:
                    segment.points.append(
                        gpxpy.gpx.GPXTrackPoint(
                            latitude=point.latitude,
                            longitude=point.longitude,
                            elevation=point.elevation,
                            time=point.time,
                        )
                    )
                new_track.segments.append(segment)
                combined.tracks.append(new_track)
                has_data = True

            if has_data:
                success += 1
            else:
                print(f"  ! {name} — no tracks or routes")

        except Exception as e:
            print(f"  X {name} — Error: {e}")
            fail += 1

    with output_path.open("w", encoding="utf-8") as f:
        f.write(combined.to_xml())

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"\nMerged: {success} files ({fail} failed), {len(combined.tracks)} tracks, {size_mb:.1f} MB")
    return output_path


# ---------------------------------------------------------------------------
# Simplify
# ---------------------------------------------------------------------------


def simplify_gpx(gpx_file: Path, *, tolerance: float = RDP_TOLERANCE) -> tuple[int, float]:
    """Simplify GPX coordinates in-place using the Ramer-Douglas-Peucker algorithm.

    Preserves elevation and timestamps on kept points. Overwrites the file.

    Returns (final_point_count, final_size_mb).
    """
    with gpx_file.open(encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    original_points = sum(len(seg.points) for trk in gpx.tracks for seg in trk.segments)

    for track in gpx.tracks:
        for segment in track.segments:
            if len(segment.points) < MIN_POINTS_FOR_RDP:
                continue

            coords = [(p.latitude, p.longitude) for p in segment.points]
            simplified = rdp(coords, epsilon=tolerance)

            new_points = []
            for lat, lon in simplified:
                closest = min(segment.points, key=lambda p: (p.latitude - lat) ** 2 + (p.longitude - lon) ** 2)
                new_points.append(
                    gpxpy.gpx.GPXTrackPoint(latitude=lat, longitude=lon, elevation=closest.elevation, time=closest.time)
                )
            segment.points = new_points

    simplified_points = sum(len(seg.points) for trk in gpx.tracks for seg in trk.segments)
    reduction = ((original_points - simplified_points) / original_points * 100) if original_points else 0

    # Write to temp then replace (atomic-ish)
    tmp = gpx_file.with_suffix(".simplified.gpx")
    with tmp.open("w", encoding="utf-8") as f:
        f.write(gpx.to_xml())

    size_mb = tmp.stat().st_size / (1024 * 1024)
    original_mb = gpx_file.stat().st_size / (1024 * 1024)
    tmp.replace(gpx_file)

    print(f"Simplified: {original_points:,} → {simplified_points:,} points ({reduction:.1f}% reduction)")
    print(f"File size: {original_mb:.1f} MB → {size_mb:.1f} MB")

    return simplified_points, size_mb


# ---------------------------------------------------------------------------
# Import to Firestore
# ---------------------------------------------------------------------------


def import_gpx_to_firestore(  # noqa: C901, PLR0912, PLR0915
    gpx_file: Path,
    *,
    source: str,
    status: str = "To Explore",
    existing_name_prefix: str = "",
    post_process: TrailPostProcessor | Callable[..., None] | None = None,
) -> tuple[int, int, int]:
    """Import tracks from a merged GPX file into Firestore.

    Firestore connection is configured via .env (loaded automatically).
    Requires FIRESTORE_PROJECT_ID and FIRESTORE_DATABASE_ID.

    Args:
        gpx_file: Path to the merged/simplified GPX file.
        source: Firestore source value (e.g. "planned_hikes", "world_wide_hikes").
        status: Default trail status.
        existing_name_prefix: If set, skip tracks whose name starts with this
            prefix and already exists in Firestore (for idempotent re-runs).
        post_process: Optional callback(trail, track) to enrich each trail
            after GPX conversion but before saving.

    Returns:
        (loaded, skipped, errors) counts.
    """
    import os
    import sys

    # Ensure project root is on sys.path so api/app packages are importable
    project_root = str(Path(__file__).resolve().parent.parent)
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from app.functions.env_loader import load_env_if_needed

    load_env_if_needed()

    project = os.environ.get("FIRESTORE_PROJECT_ID", "")
    database = os.environ.get("FIRESTORE_DATABASE_ID", "")
    if not project or not database:
        print("ERROR: FIRESTORE_PROJECT_ID and FIRESTORE_DATABASE_ID must be set.")
        print("Run: uv run python dev-tools/setup_env.py")
        sys.exit(1)

    print(f"Firestore: {project} / {database}")

    # Late imports — only needed when actually writing to Firestore
    from api.storage.firestore_client import get_collection
    from api.storage.trail_storage import save_trail
    from app.functions.trail_converter import gpx_track_to_trail

    with gpx_file.open(encoding="utf-8") as f:
        gpx_data = gpxpy.parse(f)

    print(f"Found {len(gpx_data.tracks)} tracks in {gpx_file.name}")

    # Build set of existing trail names for dedup
    existing: set[str] = set()
    if existing_name_prefix:
        collection = get_collection("trails")
        for doc in collection.where("source", "==", source).stream():
            data = doc.to_dict()
            if not data:
                continue
            name = data.get("name", "")
            if name.startswith(existing_name_prefix):
                existing.add(name)
        if existing:
            print(f"Found {len(existing)} existing '{existing_name_prefix}*' trails")

    loaded = 0
    skipped = 0
    errors = 0

    for track in gpx_data.tracks:
        try:
            segments = _split_multi_segment(track)
            for seg_track, seg_idx in segments:
                if seg_track.name in existing:
                    skipped += 1
                    continue

                trail = gpx_track_to_trail(seg_track, source=source, index=seg_idx, status=status)
                if post_process:
                    post_process(trail, seg_track)
                save_trail(trail, update_sync=False)
                loaded += 1

                if loaded % 25 == 0:
                    print(f"  Imported {loaded} trails...")

        except Exception as e:
            print(f"  ERROR importing '{track.name}': {e}")
            errors += 1

    if loaded > 0:
        from api.storage.trail_storage import _update_sync_metadata

        _update_sync_metadata()

    print(f"\nImported: {loaded}, Skipped: {skipped}, Errors: {errors}")
    return loaded, skipped, errors


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _split_multi_segment(track: gpxpy.gpx.GPXTrack) -> list[tuple[gpxpy.gpx.GPXTrack, int]]:
    """Split a multi-segment track into individual single-segment tracks.

    Returns list of (track, segment_index) tuples. Single-segment tracks
    are returned as-is with index 0.
    """
    if len(track.segments) <= 1:
        return [(track, 0)]

    result = []
    for idx, segment in enumerate(track.segments):
        t = gpxpy.gpx.GPXTrack()
        t.name = f"{track.name} - Seg {idx + 1}"
        t.description = track.description
        t.segments = [segment]
        result.append((t, idx))
    return result


def download_file(url: str, filepath: Path, *, timeout: int = 30) -> None:
    """Download a file from a URL. Validates scheme before opening."""
    import urllib.request

    if not url.startswith(("http://", "https://")):
        raise ValueError("URL must start with http:// or https://")  # noqa: TRY003, EM101
    encoded_url = url.replace(" ", "%20")
    req = urllib.request.Request(encoded_url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=timeout) as response:  # noqa: S310
        content = response.read()
    with filepath.open("wb") as f:
        f.write(content)
