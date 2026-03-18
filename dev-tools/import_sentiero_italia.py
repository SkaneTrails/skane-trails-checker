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

    # Import merged GPX into Firestore (reads .env for Firestore config)
    uv run python dev-tools/import_sentiero_italia.py import-trails

    # Import only specific regions
    uv run python dev-tools/import_sentiero_italia.py import-trails --region Sicilia
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

from gpx_pipeline import download_file, import_gpx_to_firestore, merge_gpx_files, simplify_gpx

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

        gpx_html = props.get("file_gpx", "")
        gpx_url = ""
        if gpx_html and "href=" in gpx_html:
            start = gpx_html.index('href="') + 6
            end = gpx_html.index('"', start)
            gpx_url = gpx_html[start:end]

        if not gpx_url and tappa_name:
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

        safe_name = tappa_name.replace(" ", "_").replace("/", "-")
        filename = f"{safe_name}.gpx"
        filepath = OUTPUT_DIR / filename

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
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-regions", help="List available regions and tappa counts")

    dl_parser = subparsers.add_parser("download", help="Download, merge, and simplify GPX files")
    dl_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")
    dl_parser.add_argument("--skip-simplify", action="store_true", help="Skip RDP simplification step")

    imp_parser = subparsers.add_parser("import-trails", help="Import merged GPX into Firestore")
    imp_parser.add_argument("--region", action="append", help="Filter by region (repeatable)")

    args = parser.parse_args()

    if args.command == "list-regions":
        list_regions()

    elif args.command == "download":
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

        print(f"\n{'=' * 60}")
        print("DOWNLOAD COMPLETE")
        print("=" * 60)
        print(f"GPX files: {gpx_dir}")
        print(f"Merged file: {output_file}")
        print("\nTo import into Firestore:")
        print("  uv run python dev-tools/import_sentiero_italia.py import-trails")
        if regions:
            region_args = " ".join(f"--region {r}" for r in regions)
            print(f"  (add {region_args} to match what you downloaded)")

    elif args.command == "import-trails":
        import_trails_cmd(args.region)


if __name__ == "__main__":
    main()
