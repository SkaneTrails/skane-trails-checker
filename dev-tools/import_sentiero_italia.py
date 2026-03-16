"""
Download, merge, and simplify Sentiero Italia CAI trail GPX files.

Fetches stage (tappa) metadata and nearby POIs (bus/train stations, water points,
parking) from the CAI WFS service, downloads GPX files from sentieroitalia.cai.it,
merges them into a single file, and optionally imports them into Firestore.

Data source: Club Alpino Italiano (CAI) — public WFS service.
License: ©OpenStreetMap contributors (as stated by CAI).

Usage:
    # List available regions and tappa counts
    uv run python dev-tools/import_sentiero_italia.py list-regions

    # Download all 535 tappe
    uv run python dev-tools/import_sentiero_italia.py download

    # Download only one region
    uv run python dev-tools/import_sentiero_italia.py download --region Sicilia

    # Download multiple regions
    uv run python dev-tools/import_sentiero_italia.py download --region Sicilia --region Sardegna

    # Import merged GPX into Firestore (trails + nearby POIs as places)
    uv run python dev-tools/import_sentiero_italia.py import-trails --project <project_id>

    # Import only specific regions
    uv run python dev-tools/import_sentiero_italia.py import-trails --project <id> --region Sicilia

    # Import POIs only (bus/train stations, water points, parking)
    uv run python dev-tools/import_sentiero_italia.py import-places --project <project_id>
"""

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import gpxpy
import gpxpy.gpx
from rdp import rdp
from sentiero_italia_firestore import import_places, import_trails
from sentiero_italia_wfs import fetch_all_pois, fetch_tappe, match_pois_to_tappe

OUTPUT_DIR = Path(__file__).parent / "sentiero_italia_gpx"
TRACKS_DIR = Path(__file__).parent.parent / "app" / "tracks_gpx" / "sentiero_italia"


def list_regions() -> None:
    """List all available regions with tappa counts."""
    tappe = fetch_tappe()
    regions: dict[str, int] = {}
    for t in tappe:
        regions[t["regione"]] = regions.get(t["regione"], 0) + 1

    print(f"\n{'Region':<35} {'Tappe':>6}")
    print("-" * 42)
    for region, count in sorted(regions.items()):
        print(f"{region:<35} {count:>6}")
    print("-" * 42)
    print(f"{'TOTAL':<35} {sum(regions.values()):>6}")


def download_file(url: str, filepath: Path) -> None:
    """Download a file from URL to filepath."""
    if not url.startswith(("http://", "https://")):
        raise ValueError("URL must start with http:// or https://")  # noqa: TRY003, EM101
    encoded_url = url.replace(" ", "%20")
    req = urllib.request.Request(encoded_url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=30) as response:  # noqa: S310
        content = response.read()
    with filepath.open("wb") as f:
        f.write(content)


def download_tappe(regions: list[str] | None = None) -> tuple[Path, Path, int]:
    """Download GPX files for all tappe and save full metadata + POIs."""
    print("=" * 60)
    print("STEP 1: Downloading Sentiero Italia GPX files")
    print("=" * 60)

    tappe = fetch_tappe(regions)
    if not tappe:
        print("No tappe found for the specified region(s)")
        sys.exit(1)

    pois = fetch_all_pois()
    poi_matches = match_pois_to_tappe(tappe, pois)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    failed = []
    skipped = 0

    for i, tappa in enumerate(tappe, 1):
        tappa_name = tappa["tappa"]
        gpx_url = tappa["gpx_url"]

        if not gpx_url:
            print(f"  [{i}/{len(tappe)}] {tappa_name} - No GPX URL, skipping")
            failed.append(tappa_name)
            continue

        safe_name = tappa_name.replace(" ", "_").replace("/", "-")
        filename = f"{safe_name}.gpx"
        filepath = OUTPUT_DIR / filename

        nearby_pois = poi_matches.get(tappa_name, [])
        result = {
            **tappa,
            "filename": filename,
            "nearby_bus": sum(1 for p in nearby_pois if p["layer"] == "Stazioni_bus"),
            "nearby_train": sum(1 for p in nearby_pois if p["layer"] == "Stazioni_treni"),
            "nearby_water": sum(1 for p in nearby_pois if p["layer"] == "Punti_acqua"),
            "nearby_parking": sum(1 for p in nearby_pois if p["layer"] == "Parcheggi"),
        }

        if filepath.exists():
            skipped += 1
            results.append(result)
            if skipped <= 3 or skipped % 50 == 0:  # noqa: PLR2004
                print(f"  [{i}/{len(tappe)}] {tappa_name} - already downloaded")
            continue

        try:
            print(f"  [{i}/{len(tappe)}] {tappa_name}...", end=" ", flush=True)
            download_file(gpx_url, filepath)
            results.append(result)
            print("OK")
            time.sleep(0.3)  # Rate limiting
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append(tappa_name)

    _save_download_results(results, pois, poi_matches, skipped, failed)
    return OUTPUT_DIR, OUTPUT_DIR / "sentiero_italia_mapping.csv", len(results)


def _save_download_results(
    results: list[dict], pois: list[dict], poi_matches: dict, skipped: int, failed: list[str]
) -> None:
    """Save mapping CSV and POI JSON after download."""
    csv_path = OUTPUT_DIR / "sentiero_italia_mapping.csv"
    fieldnames = [
        "tappa",
        "regione",
        "km",
        "partenza",
        "quota_partenza",
        "arrivo",
        "quota_arrivo",
        "elevation_gain",
        "elevation_loss",
        "difficolta",
        "percorribilita",
        "segnaletica",
        "data_aggiornamento",
        "note",
        "descrizione",
        "openstreetmap_id",
        "gpx_url",
        "filename",
        "centroid_lat",
        "centroid_lng",
        "nearby_bus",
        "nearby_train",
        "nearby_water",
        "nearby_parking",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    poi_path = OUTPUT_DIR / "sentiero_italia_pois.json"
    with poi_path.open("w", encoding="utf-8") as f:
        json.dump({"pois": pois, "tappa_matches": poi_matches}, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Downloaded: {len(results) - skipped} new GPX files")
    print(f"Skipped (existing): {skipped}")
    print(f"Failed: {len(failed)}")
    if failed:
        print(f"Failed tappe: {', '.join(failed[:10])}" + ("..." if len(failed) > 10 else ""))  # noqa: PLR2004
    print(f"Total available: {len(results)}")
    print(f"POIs saved: {len(pois)} ({poi_path.name})")


def merge_tappe(gpx_dir: Path, csv_path: Path, regions: list[str] | None = None) -> tuple[Path, int]:
    """Merge individual GPX files into a single combined file."""
    print(f"\n{'=' * 60}")
    print("STEP 2: Merging GPX files")
    print("=" * 60)

    with csv_path.open(encoding="utf-8") as f:
        mapping = list(csv.DictReader(f))

    if regions:
        mapping = [row for row in mapping if row["regione"] in regions]

    print(f"Processing {len(mapping)} GPX files\n")

    combined_gpx = gpxpy.gpx.GPX()
    success_count = 0
    fail_count = 0

    for row in mapping:
        tappa_name = row["tappa"]
        gpx_file = gpx_dir / row["filename"]
        if not gpx_file.exists():
            print(f"  X {tappa_name} - file not found")
            fail_count += 1
            continue

        try:
            track_name = _build_track_name(row)
            meta_json = _build_meta_json(row)
            tracks_added = _add_gpx_tracks(gpx_file, track_name, meta_json, combined_gpx)
            if tracks_added:
                success_count += 1
            else:
                print(f"  ! {tappa_name} - no tracks or routes")
        except Exception as e:
            print(f"  X {tappa_name} - Error: {e}")
            fail_count += 1

    output_file = _write_merged_gpx(combined_gpx, regions)
    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"\n{'=' * 60}")
    print(f"Merged: {success_count} files, {fail_count} failed")
    print(f"Total tracks: {len(combined_gpx.tracks)}")
    print(f"Output: {output_file} ({file_size_mb:.1f} MB)")

    return output_file, len(combined_gpx.tracks)


def _build_track_name(row: dict) -> str:
    """Build descriptive track name from CSV row."""
    tappa_name = row["tappa"]
    regione = row["regione"]
    partenza = row.get("partenza", "")
    arrivo = row.get("arrivo", "")
    if partenza and arrivo:
        return f"{tappa_name}: {partenza} - {arrivo} ({regione})"
    return f"{tappa_name} ({regione})"


def _build_meta_json(row: dict) -> str:
    """Build JSON metadata string from CSV row for embedding in track description."""
    return json.dumps(
        {
            "tappa": row.get("tappa", ""),
            "regione": row.get("regione", ""),
            "difficolta": row.get("difficolta", ""),
            "km": row.get("km", ""),
            "quota_partenza": row.get("quota_partenza", ""),
            "quota_arrivo": row.get("quota_arrivo", ""),
            "elevation_gain": row.get("elevation_gain", ""),
            "elevation_loss": row.get("elevation_loss", ""),
            "percorribilita": row.get("percorribilita", ""),
            "segnaletica": row.get("segnaletica", ""),
            "note": row.get("note", ""),
            "descrizione": row.get("descrizione", ""),
            "data_aggiornamento": row.get("data_aggiornamento", ""),
        },
        ensure_ascii=False,
    )


def _add_gpx_tracks(gpx_file: Path, track_name: str, meta_json: str, combined_gpx: gpxpy.gpx.GPX) -> bool:
    """Parse a GPX file and add its tracks/routes to the combined GPX. Returns True if any added."""
    with gpx_file.open(encoding="utf-8") as f:
        gpx_obj = gpxpy.parse(f)

    added = False
    for track in gpx_obj.tracks:
        new_track = gpxpy.gpx.GPXTrack()
        new_track.name = track_name
        new_track.description = meta_json
        for segment in track.segments:
            new_track.segments.append(segment)
        combined_gpx.tracks.append(new_track)
        added = True

    for route in gpx_obj.routes:
        new_track = gpxpy.gpx.GPXTrack()
        new_track.name = track_name
        new_track.description = meta_json
        segment = gpxpy.gpx.GPXTrackSegment()
        for point in route.points:
            segment.points.append(
                gpxpy.gpx.GPXTrackPoint(
                    latitude=point.latitude, longitude=point.longitude, elevation=point.elevation, time=point.time
                )
            )
        new_track.segments.append(segment)
        combined_gpx.tracks.append(new_track)
        added = True

    return added


def _write_merged_gpx(combined_gpx: gpxpy.gpx.GPX, regions: list[str] | None) -> Path:
    """Write the combined GPX to the tracks directory."""
    region_suffix = "-".join(r.lower().replace(" ", "_") for r in regions) if regions else "all"
    output_file = TRACKS_DIR / f"sentiero-italia-{region_suffix}.gpx"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as f:
        f.write(combined_gpx.to_xml())
    return output_file


def simplify_gpx(gpx_file: Path, tolerance: float = 0.00005) -> tuple[int, float]:
    """Simplify GPX coordinates using RDP algorithm."""
    print(f"\n{'=' * 60}")
    print("STEP 3: Simplifying coordinates")
    print("=" * 60)

    with gpx_file.open(encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    original_points = sum(len(seg.points) for trk in gpx.tracks for seg in trk.segments)
    print(f"Original: {len(gpx.tracks)} tracks, {original_points:,} points")

    for track in gpx.tracks:
        for segment in track.segments:
            if len(segment.points) < 3:  # noqa: PLR2004
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
    reduction = ((original_points - simplified_points) / original_points) * 100 if original_points else 0

    simplified_file = gpx_file.with_suffix(".simplified.gpx")
    with simplified_file.open("w", encoding="utf-8") as f:
        f.write(gpx.to_xml())

    final_size_mb = simplified_file.stat().st_size / (1024 * 1024)
    original_size_mb = gpx_file.stat().st_size / (1024 * 1024)

    print(f"Simplified: {simplified_points:,} points ({reduction:.1f}% reduction)")
    print(f"File size: {original_size_mb:.1f} MB -> {final_size_mb:.1f} MB")

    simplified_file.replace(gpx_file)
    print(f"Replaced {gpx_file.name} with simplified version")

    return simplified_points, final_size_mb


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download and import Sentiero Italia CAI trail GPX files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s list-regions
  %(prog)s download --region Sicilia
  %(prog)s download --region Sicilia --region Sardegna
  %(prog)s import-trails --project my-gcp-project --region Sicilia
  %(prog)s import-places --project my-gcp-project --region Sicilia
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-regions", help="List available regions and tappa counts")

    dl_parser = subparsers.add_parser("download", help="Download, merge, and simplify GPX files")
    dl_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")
    dl_parser.add_argument("--skip-simplify", action="store_true", help="Skip RDP simplification step")

    imp_parser = subparsers.add_parser("import-trails", help="Import merged GPX into Firestore")
    imp_parser.add_argument("--project", required=True, help="GCP project ID")
    imp_parser.add_argument("--database", default="", help="Firestore database ID")
    imp_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

    places_parser = subparsers.add_parser(
        "import-places", help="Import POIs (bus, train, water, parking) into Firestore"
    )
    places_parser.add_argument("--project", required=True, help="GCP project ID")
    places_parser.add_argument("--database", default="", help="Firestore database ID")
    places_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

    args = parser.parse_args()

    if args.command == "list-regions":
        list_regions()

    elif args.command == "download":
        regions = args.region
        gpx_dir, csv_path, count = download_tappe(regions)
        if count == 0:
            return
        output_file, _track_count = merge_tappe(gpx_dir, csv_path, regions)
        if not args.skip_simplify:
            simplify_gpx(output_file)

        print(f"\n{'=' * 60}")
        print("DOWNLOAD COMPLETE")
        print("=" * 60)
        print(f"GPX files: {gpx_dir}")
        print(f"Merged file: {output_file}")
        print("\nTo import into Firestore:")
        print("  uv run python dev-tools/import_sentiero_italia.py import-trails --project <project_id>")
        print("  uv run python dev-tools/import_sentiero_italia.py import-places --project <project_id>")
        if regions:
            region_args = " ".join(f"--region {r}" for r in regions)
            print(f"  (add {region_args} to match what you downloaded)")

    elif args.command == "import-trails":
        import_trails(args.project, args.database, args.region, tracks_dir=TRACKS_DIR, output_dir=OUTPUT_DIR)

    elif args.command == "import-places":
        import_places(args.project, args.database, args.region, output_dir=OUTPUT_DIR)


if __name__ == "__main__":
    main()
