"""
Download, merge, and simplify Sentiero Italia CAI trail GPX files.

Fetches stage (tappa) metadata from the CAI WFS service, downloads GPX files
from sentieroitalia.cai.it, merges them into a single file, and optionally
imports them into Firestore as planned hikes.

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

    # Import merged GPX into Firestore
    uv run python dev-tools/import_sentiero_italia.py import-trails --project <project_id>

    # Import only specific regions
    uv run python dev-tools/import_sentiero_italia.py import-trails --project <id> --region Sicilia
"""

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import gpxpy
import gpxpy.gpx
from rdp import rdp

WFS_BASE = "https://sentieroitaliamappe.cai.it/index.php/lizmap/service?repository=sicaipubblico&project=SICAI_Pubblico"
GPX_BASE = "https://sentieroitalia.cai.it/gpxfiles"
OUTPUT_DIR = Path(__file__).parent / "sentiero_italia_gpx"
TRACKS_DIR = Path(__file__).parent.parent / "app" / "tracks_gpx" / "sentiero_italia"


def _wfs_request(params: dict) -> bytes:
    """Make a WFS request and return response bytes."""
    query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    url = f"{WFS_BASE}&{query}"
    if not url.startswith("https://"):
        raise ValueError("URL must be HTTPS")  # noqa: TRY003, EM101
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=30) as response:  # noqa: S310
        return response.read()


def fetch_tappe(regions: list[str] | None = None) -> list[dict]:
    """Fetch all tappa metadata from WFS service.

    Returns list of dicts with keys: tappa, regione, km, partenza, arrivo,
    difficolta, gpx_url.
    """
    print("Fetching tappa catalog from CAI WFS service...")
    data = _wfs_request(
        {
            "SERVICE": "WFS",
            "VERSION": "1.0.0",
            "REQUEST": "GetFeature",
            "TYPENAME": "SI_Tappe",
            "MAXFEATURES": "1000",
            "OUTPUTFORMAT": "GeoJSON",
            "PROPERTYNAME": "tappa,regione,km,partenza,arrivo,difficolta,file_gpx",
        }
    )
    geojson = json.loads(data)
    features = geojson.get("features", [])

    tappe = []
    for feat in features:
        props = feat["properties"]
        tappa_name = props.get("tappa", "")
        regione = props.get("regione", "")

        if regions and regione not in regions:
            continue

        # Extract GPX URL from HTML link in file_gpx field
        gpx_html = props.get("file_gpx", "")
        gpx_url = ""
        if gpx_html and "href=" in gpx_html:
            start = gpx_html.index('href="') + 6
            end = gpx_html.index('"', start)
            gpx_url = gpx_html[start:end]

        if not gpx_url and tappa_name:
            # Fallback: construct URL from tappa name
            encoded_name = urllib.parse.quote(tappa_name)
            gpx_url = f"{GPX_BASE}/{encoded_name}.gpx"

        tappe.append(
            {
                "tappa": tappa_name,
                "regione": regione,
                "km": props.get("km"),
                "partenza": props.get("partenza", ""),
                "arrivo": props.get("arrivo", ""),
                "difficolta": props.get("difficolta", ""),
                "gpx_url": gpx_url,
            }
        )

    tappe.sort(key=lambda t: (t["regione"], t["tappa"]))
    print(f"Found {len(tappe)} tappe" + (f" in {', '.join(regions)}" if regions else ""))
    return tappe


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
    # Encode spaces in URL path (CAI URLs contain unencoded spaces like "SI P03.gpx")
    encoded_url = url.replace(" ", "%20")
    req = urllib.request.Request(encoded_url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=30) as response:  # noqa: S310
        content = response.read()
    with filepath.open("wb") as f:
        f.write(content)


def download_tappe(regions: list[str] | None = None) -> tuple[Path, Path, int]:
    """Download GPX files for all tappe."""
    print("=" * 60)
    print("STEP 1: Downloading Sentiero Italia GPX files")
    print("=" * 60)

    tappe = fetch_tappe(regions)
    if not tappe:
        print("No tappe found for the specified region(s)")
        sys.exit(1)

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

        # Use tappa name as filename (spaces replaced with underscores)
        safe_name = tappa_name.replace(" ", "_").replace("/", "-")
        filename = f"{safe_name}.gpx"
        filepath = OUTPUT_DIR / filename

        # Skip if already downloaded
        if filepath.exists():
            skipped += 1
            results.append({**tappa, "filename": filename})
            if skipped <= 3 or skipped % 50 == 0:  # noqa: PLR2004
                print(f"  [{i}/{len(tappe)}] {tappa_name} - already downloaded")
            continue

        try:
            print(f"  [{i}/{len(tappe)}] {tappa_name}...", end=" ", flush=True)
            download_file(gpx_url, filepath)
            results.append({**tappa, "filename": filename})
            print("OK")
            time.sleep(0.3)  # Rate limiting
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append(tappa_name)

    # Save mapping CSV
    csv_path = OUTPUT_DIR / "sentiero_italia_mapping.csv"
    fieldnames = ["tappa", "regione", "km", "partenza", "arrivo", "difficolta", "gpx_url", "filename"]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{'=' * 60}")
    print(f"Downloaded: {len(results) - skipped} new GPX files")
    print(f"Skipped (existing): {skipped}")
    print(f"Failed: {len(failed)}")
    if failed:
        print(f"Failed tappe: {', '.join(failed[:10])}" + ("..." if len(failed) > 10 else ""))  # noqa: PLR2004
    print(f"Total available: {len(results)}")

    return OUTPUT_DIR, csv_path, len(results)


def merge_tappe(gpx_dir: Path, csv_path: Path, regions: list[str] | None = None) -> tuple[Path, int]:  # noqa: C901, PLR0915
    """Merge individual GPX files into a single combined file."""
    print(f"\n{'=' * 60}")
    print("STEP 2: Merging GPX files")
    print("=" * 60)

    mapping = []
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        mapping = list(reader)

    if regions:
        mapping = [row for row in mapping if row["regione"] in regions]

    print(f"Processing {len(mapping)} GPX files\n")

    combined_gpx = gpxpy.gpx.GPX()
    success_count = 0
    fail_count = 0

    for row in mapping:
        tappa_name = row["tappa"]
        regione = row["regione"]
        partenza = row.get("partenza", "")
        arrivo = row.get("arrivo", "")
        filename = row["filename"]

        gpx_file = gpx_dir / filename
        if not gpx_file.exists():
            print(f"  X {tappa_name} - file not found")
            fail_count += 1
            continue

        try:
            with gpx_file.open(encoding="utf-8") as f:
                gpx_obj = gpxpy.parse(f)

            # Build descriptive track name
            track_name = f"{tappa_name} ({regione})"
            if partenza and arrivo:
                track_name = f"{tappa_name}: {partenza} - {arrivo} ({regione})"

            for track in gpx_obj.tracks:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = track_name
                for segment in track.segments:
                    new_track.segments.append(segment)
                combined_gpx.tracks.append(new_track)

            # Convert routes to tracks (some GPX files use routes instead)
            for route in gpx_obj.routes:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = track_name
                segment = gpxpy.gpx.GPXTrackSegment()
                for point in route.points:
                    track_point = gpxpy.gpx.GPXTrackPoint(
                        latitude=point.latitude, longitude=point.longitude, elevation=point.elevation, time=point.time
                    )
                    segment.points.append(track_point)
                new_track.segments.append(segment)
                combined_gpx.tracks.append(new_track)

            if gpx_obj.tracks or gpx_obj.routes:
                success_count += 1
            else:
                print(f"  ! {tappa_name} - no tracks or routes")

        except Exception as e:
            print(f"  X {tappa_name} - Error: {e}")
            fail_count += 1

    # Write combined file
    region_suffix = "-".join(r.lower().replace(" ", "_") for r in regions) if regions else "all"
    output_filename = f"sentiero-italia-{region_suffix}.gpx"
    output_file = TRACKS_DIR / output_filename
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as f:
        f.write(combined_gpx.to_xml())

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"\n{'=' * 60}")
    print(f"Merged: {success_count} files, {fail_count} failed")
    print(f"Total tracks: {len(combined_gpx.tracks)}")
    print(f"Output: {output_file} ({file_size_mb:.1f} MB)")

    return output_file, len(combined_gpx.tracks)


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

    # Write simplified version, then replace original
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


def import_trails(project: str, database: str, regions: list[str] | None = None) -> None:  # noqa: C901, PLR0912, PLR0915
    """Import merged GPX file into Firestore as world_wide_hikes."""
    # Determine which merged file to use
    region_suffix = "-".join(r.lower().replace(" ", "_") for r in regions) if regions else "all"
    gpx_file = TRACKS_DIR / f"sentiero-italia-{region_suffix}.gpx"

    if not gpx_file.exists():
        print(f"Merged GPX file not found: {gpx_file}")
        print("Run 'download' first to create it.")
        sys.exit(1)

    # Late import to avoid requiring GCP credentials for download-only usage
    # Set project/database env vars for Firestore client
    import os

    from api.storage.firestore_client import get_collection
    from api.storage.trail_storage import save_trail
    from app.functions.trail_converter import gpx_track_to_trail

    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    if database:
        os.environ["FIRESTORE_DATABASE"] = database

    print(f"\n{'=' * 60}")
    print(f"Importing trails from {gpx_file.name}")
    print(f"Project: {project}, Database: {database or '(default)'}")
    print("=" * 60)

    with gpx_file.open(encoding="utf-8") as f:
        gpx_data = gpxpy.parse(f)

    print(f"Found {len(gpx_data.tracks)} tracks in GPX file")

    # Check how many world_wide_hikes already exist with "SI " prefix
    collection = get_collection("trails")
    existing = set()
    for doc in collection.where("source", "==", "world_wide_hikes").stream():
        data = doc.to_dict()
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
            if len(track.segments) > 1:
                for seg_idx, segment in enumerate(track.segments):
                    temp_track = gpxpy.gpx.GPXTrack()
                    temp_track.name = f"{track.name} - Seg {seg_idx + 1}"
                    temp_track.segments = [segment]

                    if temp_track.name in existing:
                        skipped += 1
                        continue

                    trail = gpx_track_to_trail(
                        temp_track, source="world_wide_hikes", index=seg_idx, status="To Explore"
                    )
                    save_trail(trail, update_sync=False)
                    loaded += 1
            else:
                if track.name in existing:
                    skipped += 1
                    continue

                trail = gpx_track_to_trail(track, source="world_wide_hikes", index=0, status="To Explore")
                save_trail(trail, update_sync=False)
                loaded += 1

            if loaded % 25 == 0 and loaded > 0:
                print(f"  Imported {loaded} trails...")

        except Exception as e:
            print(f"  ERROR importing '{track.name}': {e}")
            errors += 1

    # Update sync metadata once after all imports
    if loaded > 0:
        from api.storage.trail_storage import _update_sync_metadata

        _update_sync_metadata()

    print(f"\n{'=' * 60}")
    print(f"Imported: {loaded} trails")
    print(f"Skipped (existing): {skipped}")
    print(f"Errors: {errors}")


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
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # list-regions
    subparsers.add_parser("list-regions", help="List available regions and tappa counts")

    # download
    dl_parser = subparsers.add_parser("download", help="Download, merge, and simplify GPX files")
    dl_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")
    dl_parser.add_argument("--skip-simplify", action="store_true", help="Skip RDP simplification step")

    # import-trails
    imp_parser = subparsers.add_parser("import-trails", help="Import merged GPX into Firestore")
    imp_parser.add_argument("--project", required=True, help="GCP project ID")
    imp_parser.add_argument("--database", default="", help="Firestore database ID")
    imp_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

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
        if regions:
            region_args = " ".join(f"--region {r}" for r in regions)
            print(f"  (add {region_args} to match what you downloaded)")

    elif args.command == "import-trails":
        import_trails(args.project, args.database, args.region)


if __name__ == "__main__":
    main()
