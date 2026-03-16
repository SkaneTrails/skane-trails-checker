"""Firestore import functions for Sentiero Italia trails and POIs.

Imports merged GPX trails with CAI metadata enrichment and POIs as places.
"""

import contextlib
import csv
import hashlib
import json
import re
from pathlib import Path

# -- CAI difficulty codes to human-readable labels --
CAI_DIFFICULTY = {
    "T": "Turistico (Tourist)",
    "E": "Escursionistico (Hiking)",
    "EE": "Escursionisti Esperti (Expert Hikers)",
    "EEA": "Escursionisti Esperti con Attrezzatura (Expert, equipped)",
}


def load_tappa_metadata(csv_path: Path, regions: list[str] | None = None) -> dict[str, dict]:
    """Load tappa metadata from CSV into a lookup by tappa name."""
    lookup: dict[str, dict] = {}
    with csv_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if regions and row["regione"] not in regions:
                continue
            lookup[row["tappa"]] = row
    return lookup


def apply_cai_metadata(trail, cai_meta: dict) -> None:  # noqa: ANN001
    """Apply CAI tappa metadata to a TrailResponse object.

    Sets difficulty from CAI code, applies CAI elevation/distance if missing
    from the GPX data.
    """
    if not cai_meta:
        return

    diff_code = cai_meta.get("difficolta", "")
    if diff_code:
        trail.difficulty = CAI_DIFFICULTY.get(diff_code, diff_code)

    cai_gain = cai_meta.get("elevation_gain")
    cai_loss = cai_meta.get("elevation_loss")
    if cai_gain and trail.elevation_gain is None:
        with contextlib.suppress(ValueError, TypeError):
            trail.elevation_gain = float(cai_gain)
    if cai_loss and trail.elevation_loss is None:
        with contextlib.suppress(ValueError, TypeError):
            trail.elevation_loss = float(cai_loss)

    cai_km = cai_meta.get("km")
    if cai_km:
        with contextlib.suppress(ValueError, TypeError):
            trail.length_km = round(float(cai_km), 2)


def import_trails(  # noqa: C901, PLR0912, PLR0915
    project: str, database: str, regions: list[str] | None = None, *, tracks_dir: Path, output_dir: Path
) -> None:
    """Import merged GPX file into Firestore as world_wide_hikes.

    Enriches each trail with CAI metadata: difficulty, elevation, length.
    """
    import os

    import gpxpy
    import gpxpy.gpx

    from api.storage.firestore_client import get_collection
    from api.storage.trail_storage import save_trail
    from app.functions.trail_converter import gpx_track_to_trail

    region_suffix = "-".join(r.lower().replace(" ", "_") for r in regions) if regions else "all"
    gpx_file = tracks_dir / f"sentiero-italia-{region_suffix}.gpx"

    if not gpx_file.exists():
        print(f"Merged GPX file not found: {gpx_file}")
        print("Run 'download' first to create it.")
        return

    csv_path = output_dir / "sentiero_italia_mapping.csv"
    tappa_meta = load_tappa_metadata(csv_path, regions) if csv_path.exists() else {}

    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    if database:
        os.environ["FIRESTORE_DATABASE"] = database

    print(f"\n{'=' * 60}")
    print(f"Importing trails from {gpx_file.name}")
    print(f"Project: {project}, Database: {database or '(default)'}")
    if tappa_meta:
        print(f"Metadata loaded for {len(tappa_meta)} tappe")
    print("=" * 60)

    with gpx_file.open(encoding="utf-8") as f:
        gpx_data = gpxpy.parse(f)

    print(f"Found {len(gpx_data.tracks)} tracks in GPX file")

    collection = get_collection("trails")
    existing = set()
    for doc in collection.where("source", "==", "world_wide_hikes").stream():
        data = doc.to_dict()
        if not data:
            continue
        name = data.get("name", "")
        if name.startswith("SI "):
            existing.add(name)

    if existing:
        print(f"Found {len(existing)} existing Sentiero Italia trails in Firestore")

    loaded = 0
    skipped = 0
    errors = 0

    for track in gpx_data.tracks:
        try:
            cai_meta = _extract_track_metadata(track, tappa_meta)

            if len(track.segments) > 1:
                for seg_idx, segment in enumerate(track.segments):
                    seg_name = f"{track.name} - Seg {seg_idx + 1}"
                    if seg_name in existing:
                        skipped += 1
                        continue

                    temp_track = gpxpy.gpx.GPXTrack()
                    temp_track.name = seg_name
                    temp_track.segments = [segment]

                    trail = gpx_track_to_trail(
                        temp_track, source="world_wide_hikes", index=seg_idx, status="To Explore"
                    )
                    apply_cai_metadata(trail, cai_meta)
                    save_trail(trail, update_sync=False)
                    loaded += 1
            else:
                if track.name in existing:
                    skipped += 1
                    continue

                trail = gpx_track_to_trail(track, source="world_wide_hikes", index=0, status="To Explore")
                apply_cai_metadata(trail, cai_meta)
                save_trail(trail, update_sync=False)
                loaded += 1

            if loaded % 25 == 0 and loaded > 0:
                print(f"  Imported {loaded} trails...")

        except Exception as e:
            print(f"  ERROR importing '{track.name}': {e}")
            errors += 1

    if loaded > 0:
        from api.storage.trail_storage import _update_sync_metadata

        _update_sync_metadata()

    print(f"\n{'=' * 60}")
    print(f"Imported: {loaded} trails")
    print(f"Skipped (existing): {skipped}")
    print(f"Errors: {errors}")


def _extract_track_metadata(track, tappa_meta: dict) -> dict:  # noqa: ANN001
    """Extract CAI metadata from track description JSON or CSV lookup."""
    cai_meta: dict = {}
    if track.description:
        with contextlib.suppress(json.JSONDecodeError, TypeError):
            cai_meta = json.loads(track.description)

    if not cai_meta:
        tappa_match = re.match(r"(SI \w+)", track.name or "")
        if tappa_match:
            cai_meta = tappa_meta.get(tappa_match.group(1), {})

    return cai_meta


def import_places(project: str, database: str, regions: list[str] | None = None, *, output_dir: Path) -> None:
    """Import POIs (bus/train stations, water points, parking) as places."""
    import os

    from api.storage.places_storage import save_place

    poi_path = output_dir / "sentiero_italia_pois.json"
    if not poi_path.exists():
        print(f"POI data not found: {poi_path}")
        print("Run 'download' first to fetch POI data.")
        return

    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    if database:
        os.environ["FIRESTORE_DATABASE"] = database

    with poi_path.open(encoding="utf-8") as f:
        data = json.load(f)

    all_pois: list[dict] = data.get("pois", [])

    if regions:
        all_pois = _filter_pois_by_regions(data, output_dir, regions, all_pois)

    print(f"\n{'=' * 60}")
    print(f"Importing {len(all_pois)} POIs as places")
    print(f"Project: {project}, Database: {database or '(default)'}")
    print("=" * 60)

    loaded = 0
    errors = 0

    for poi in all_pois:
        try:
            place = _poi_to_place(poi)
            save_place(place)
            loaded += 1

            if loaded % 100 == 0:
                print(f"  Imported {loaded} places...")

        except Exception as e:
            print(f"  ERROR importing POI '{poi.get('name', '?')}': {e}")
            errors += 1

    print(f"\n{'=' * 60}")
    print(f"Imported: {loaded} places")
    print(f"Errors: {errors}")


def _poi_to_place(poi: dict):  # noqa: ANN202
    """Convert a POI dict to a PlaceResponse object."""
    from api.models.place import PlaceCategoryResponse, PlaceResponse

    coord_key = f"{poi['lat']:.6f},{poi['lng']:.6f}"
    place_id = (
        "si_"
        + hashlib.md5(  # noqa: S324
            f"{poi['layer']}_{coord_key}".encode()
        ).hexdigest()[:10]
    )

    category = PlaceCategoryResponse(name=poi["category_name"], slug=poi["category_slug"], icon=poi["category_icon"])

    name = poi.get("name") or poi["category_name"]
    operator = poi.get("operator", "")
    if operator and operator not in name:
        name = f"{name} ({operator})"

    return PlaceResponse(
        place_id=place_id, name=name, lat=poi["lat"], lng=poi["lng"], categories=[category], source="sentiero_italia"
    )


def _filter_pois_by_regions(data: dict, output_dir: Path, regions: list[str], all_pois: list[dict]) -> list[dict]:
    """Filter POIs to those near tappe in the specified regions."""
    tappa_matches = data.get("tappa_matches", {})
    csv_path = output_dir / "sentiero_italia_mapping.csv"
    if not csv_path.exists():
        return all_pois

    region_meta = load_tappa_metadata(csv_path, regions)
    region_tappa_names = set(region_meta.keys())
    region_poi_coords: set[tuple[float, float]] = set()

    for tappa_name, matched_pois in tappa_matches.items():
        if tappa_name in region_tappa_names:
            for poi in matched_pois:
                region_poi_coords.add((round(poi["lat"], 6), round(poi["lng"], 6)))

    return [p for p in all_pois if (round(p["lat"], 6), round(p["lng"], 6)) in region_poi_coords]
