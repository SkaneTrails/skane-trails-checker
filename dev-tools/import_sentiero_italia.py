"""
Download, merge, and simplify Sentiero Italia CAI trail GPX files.

Fetches stage (tappa) metadata from the CAI WFS service, downloads GPX files
from sentieroitalia.cai.it, merges them into a single file, and optionally
imports them into Firestore as world_wide_hikes.

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

    # Import merged GPX into Firestore (reads .env for Firestore config)
    uv run python dev-tools/import_sentiero_italia.py import-trails

    # Import only specific regions
    uv run python dev-tools/import_sentiero_italia.py import-trails --region Sicilia

    # Import POIs (bus/train stations, water points, parking) as places
    uv run python dev-tools/import_sentiero_italia.py import-places
"""

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path

from gpx_pipeline import download_file, import_gpx_to_firestore, merge_gpx_files, simplify_gpx
from sentiero_italia_firestore import import_places
from sentiero_italia_wfs import fetch_all_pois, fetch_tappe, match_pois_to_tappe

GPX_BASE = "https://sentieroitalia.cai.it/gpxfiles"
OUTPUT_DIR = Path(__file__).parent / "sentiero_italia_gpx"
TRACKS_DIR = Path(__file__).parent.parent / "app" / "tracks_gpx" / "sentiero_italia"

# Allow only safe characters in filenames derived from remote data
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._\- ]")


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

        safe_name = _SAFE_NAME_RE.sub("", tappa_name).replace(" ", "_")
        filename = f"{safe_name}.gpx"
        filepath = OUTPUT_DIR / filename

        # Ensure the resolved path stays within OUTPUT_DIR
        if not filepath.resolve().is_relative_to(OUTPUT_DIR.resolve()):
            print(f"  [{i}/{len(tappe)}] {tappa_name} - unsafe path, skipping")
            failed.append(tappa_name)
            continue

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
            time.sleep(0.3)
        except Exception as e:
            print(f"FAILED: {e}")
            failed.append(tappa_name)

    csv_path = _write_download_csv(results)

    print(f"\n{'=' * 60}")
    print(f"Downloaded: {len(results) - skipped} new GPX files")
    print(f"Skipped (existing): {skipped}")
    print(f"Failed: {len(failed)}")
    if failed:
        print(f"Failed tappe: {', '.join(failed[:10])}" + ("..." if len(failed) > 10 else ""))  # noqa: PLR2004
    print(f"Total available: {len(results)}")

    return OUTPUT_DIR, csv_path, len(results)


def _write_download_csv(results: list[dict]) -> Path:
    """Write the download results to a CSV mapping file."""
    csv_path = OUTPUT_DIR / "sentiero_italia_mapping.csv"
    fieldnames = ["tappa", "regione", "km", "partenza", "arrivo", "difficolta", "gpx_url", "filename"]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return csv_path


def _csv_to_trail_files(gpx_dir: Path, csv_path: Path, regions: list[str] | None = None) -> list[dict]:
    """Convert the download mapping CSV to TrailFile entries for the pipeline."""
    with csv_path.open(encoding="utf-8") as f:
        mapping = list(csv.DictReader(f))

    if regions:
        mapping = [row for row in mapping if row["regione"] in regions]

    trail_files = []
    for row in mapping:
        tappa_name = row["tappa"]
        regione = row["regione"]
        partenza = row.get("partenza", "")
        arrivo = row.get("arrivo", "")

        name = f"{tappa_name} ({regione})"
        if partenza and arrivo:
            name = f"{tappa_name}: {partenza} - {arrivo} ({regione})"

        trail_files.append({"gpx_path": gpx_dir / row["filename"], "name": name})

    return trail_files


def _get_output_path(regions: list[str] | None) -> Path:
    """Build the merged GPX output path based on region filter."""
    suffix = "-".join(r.lower().replace(" ", "_") for r in regions) if regions else "all"
    return TRACKS_DIR / f"sentiero-italia-{suffix}.gpx"


def import_trails_cmd(regions: list[str] | None = None) -> None:
    """Import merged GPX file into Firestore as world_wide_hikes."""
    gpx_file = _get_output_path(regions)

    if not gpx_file.exists():
        print(f"Merged GPX file not found: {gpx_file}")
        print("Run 'download' first to create it.")
        sys.exit(1)

    import_gpx_to_firestore(gpx_file, source="world_wide_hikes", status="To Explore", existing_name_prefix="SI ")


def import_places_cmd(regions: list[str] | None = None) -> None:
    """Import POIs as places into Firestore."""
    import_places(regions, output_dir=OUTPUT_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download and import Sentiero Italia CAI trail GPX files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s list-regions
  %(prog)s download --region Sicilia
  %(prog)s download --region Sicilia --region Sardegna
  %(prog)s import-trails --region Sicilia
  %(prog)s import-places
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-regions", help="List available regions and tappa counts")

    dl_parser = subparsers.add_parser("download", help="Download, merge, and simplify GPX files")
    dl_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")
    dl_parser.add_argument("--skip-simplify", action="store_true", help="Skip RDP simplification step")

    imp_parser = subparsers.add_parser("import-trails", help="Import merged GPX into Firestore")
    imp_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

    places_parser = subparsers.add_parser("import-places", help="Import POIs as places into Firestore")
    places_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

    args = parser.parse_args()

    if args.command == "list-regions":
        list_regions()

    elif args.command == "download":
        _run_download(args)

    elif args.command == "import-trails":
        import_trails_cmd(args.region)

    elif args.command == "import-places":
        import_places_cmd(args.region)


def _run_download(args: argparse.Namespace) -> None:
    """Execute the download pipeline: fetch GPX → merge → simplify → fetch POIs."""
    regions = args.region
    gpx_dir, csv_path, count = download_tappe(regions)
    if count == 0:
        return

    print(f"\n{'=' * 60}")
    print("STEP 2: Merging GPX files")
    print("=" * 60)
    output_file = _get_output_path(regions)
    trail_files = _csv_to_trail_files(gpx_dir, csv_path, regions)
    merge_gpx_files(trail_files, output_file)

    if not args.skip_simplify:
        print(f"\n{'=' * 60}")
        print("STEP 3: Simplifying coordinates")
        print("=" * 60)
        simplify_gpx(output_file)

    # Fetch POIs and match to tappe (for later import-places)
    print(f"\n{'=' * 60}")
    print("STEP 4: Fetching POI data")
    print("=" * 60)
    try:
        all_pois = fetch_all_pois()
        tappe_with_centroids = fetch_tappe(regions)
        tappa_matches = match_pois_to_tappe(tappe_with_centroids, all_pois)
        poi_path = OUTPUT_DIR / "sentiero_italia_pois.json"
        with poi_path.open("w", encoding="utf-8") as f:
            json.dump({"pois": all_pois, "tappa_matches": tappa_matches}, f, ensure_ascii=False)
        print(f"Saved {len(all_pois)} POIs to {poi_path}")
    except Exception as e:
        print(f"WARNING: POI fetch failed (import-places will not work): {e}")

    print(f"\n{'=' * 60}")
    print("DOWNLOAD COMPLETE")
    print("=" * 60)
    print(f"GPX files: {gpx_dir}")
    print(f"Merged file: {output_file}")
    print("\nTo import into Firestore:")
    print("  uv run python dev-tools/import_sentiero_italia.py import-trails")
    print("  uv run python dev-tools/import_sentiero_italia.py import-places")
    if regions:
        region_args = " ".join(f"--region {r}" for r in regions)
        print(f"  (add {region_args} to match what you downloaded)")


if __name__ == "__main__":
    main()
