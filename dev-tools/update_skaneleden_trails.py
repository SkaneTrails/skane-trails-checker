"""
Download, merge, and simplify Skåneleden trail GPX files.

This script performs three steps:
1. Downloads all GPX files from the official Skåneleden website
2. Merges them into a single all-skane-trails.gpx file with proper names
3. Simplifies the coordinates using RDP algorithm to reduce file size

Uses the shared gpx_pipeline module for merge and simplify steps.

Usage:
    python update_skaneleden_trails.py
"""

import csv
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from gpx_pipeline import download_file, merge_gpx_files, simplify_gpx


def fetch_page(url: str) -> str:
    """Fetch URL content without JavaScript rendering."""
    if not url.startswith(("http://", "https://")):
        raise ValueError("URL must start with 'http://' or 'https://'")  # noqa: TRY003, EM101
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=15) as response:  # noqa: S310
        return response.read().decode("utf-8")


def download_trails() -> tuple[Path, Path, int]:
    """Download all Skåneleden GPX files from official website."""
    print("=" * 60)
    print("STEP 1: Downloading Skåneleden GPX files")
    print("=" * 60)

    # Output directory
    script_dir = Path(__file__).parent
    output_dir = script_dir / "skaneleden_gpx"
    output_dir.mkdir(exist_ok=True)

    # Manually list known etapps per trail
    known_etapps = {
        "SL1": [
            "1-solvesborg-grundsjon",
            "2-nasum-nasums-bokskogar",
            "2-grundsjon-ostafors",
            "3-ostafors-bokestad",
            "3a-bokestad-olofstrom",
            "3a-olofstrom-halens-camping",
            "4-bokestad-brotorpet",
            "5-brotorpet-vesslarp",
            "6-vesslarp-glimakra",
            "7-glimakra-osby",
            "8-osby-verum",
            "9-verum-vittsjo",
            "10-vittsjo-harsjo",
            "11-harsjo-larkesholm",
            "12-larkesholm-bjarabygget",
            "12a-larkesholm-grytasa",
            "13-bjarabygget-koarp",
            "14-koarp-brammarp",
            "15-brammarp-bastad",
            "15-bastad",
            "16-bastad-hovs-hallar",
            "16-bastad-skummeslov",
            "16-bastad-tagstation",
            "17-hovs-hallar-torekov",
            "18-torekov-vejbystrand",
            "19-vejbystrand-halehall",
            "20-halehall-orlid",
            "21-angelsbacksstrand-bastad",
            "22-vejbystrand-angelholm",
            "23-angelholm-utvalinge",
        ],
        "SL2": [
            "1-harsjo-hillarp",
            "2-hillarp-vedema",
            "3-vedema-hassleholm",
            "4-hassleholm-goingeasen",
            "4a-goingeasen-hovdala",
            "4b-hovdala-skyrup",
            "4c-skyrup-hassleholm",
            "5-goingeasen-lillsjodal",
            "6-lillsjodal-frostavallen",
            "6-lillsjodal-maglebjartjornarp",
            "6-lillsjodal-maglebjarsosdala",
            "7-frostavallen-hoor",
            "8-hoor-bjeverod",
            "9-bjeverod-horby-ringsjostrand",
            "9a-fulltofta-runt",
            "10-ringsjostrand-rovarekulan",
            "11-rovarekulan-hoghult",
            "12-hoghult-krankesjon",
            "13-krankesjon-vaderkullen",
            "13a-skrylleslingan",
            "14-vaderkullen-hackeberga",
            "14-vaderkullen-hackebergaveberod",
            "15-hackeberga-sturup",
            "15-hackeberga-sturupgenarp",
            "15a-sturup-dorrod",
            "16-sturup-eksholmssjon",
            "16-sturup-eksholmssjonmalmo-airport",
            "17-eksholmssjon-torup",
            "18-torup-malmo-bulltofta",
            "19-dorrod-blentarp",
            "20-blentarp-snogeholm",
            "21-torup-fru-alstad",
            "22-fru-alstad-trelleborg",
        ],
        "SL3": [
            "1-astorp-haleback",
            "2-haleback-krika-skog",
            "3-krika-skog-klaverod",
            "4-klaverod-soderasens-nationalpark",
            "5-soderasens-nationalpark-jallabjar",
            "6-jallabjar-s-hultarp",
            "7-s-hultarp-frostavallen",
            "8-frostavallen-hoor",
            "9-hoor-bjeverod",
            "9-onsvalakallan",
            "10-bjeverod-ekerod",
            "11-ekerod-timan",
            "12-timan-rebbetuarod",
            "13-rebbetuarod-agusa",
            "14-agusa-brosarp",
            "14-brosarps-busstation",
        ],
        "SL4": [
            "1-ystad-nybrostrand",
            "2-nybrostrand-loderups-strandbad",
            "3-loderups-strandbad-borrby-strandbad",
            "4-borrby-strandbad-simrishamn",
            "5-simrishamn-kivik",
            "6-kivik-brosarp",
            "7-brosarp-alunbruket",
            "7-brosarp-busstation",
            "7a-alunbruket-agusa",
            "7b-agusa-brosarp",
            "8-alunbruket-heinge",
            "9-heinge-lovestads-asar",
            "10-lovestads-asar-vitaback",
            "11-vitaback-snogeholm",
            "12-snogeholm-ystad",
        ],
        "SL5": [
            "1-utvalinge-jonstorp",
            "2-jonstorp-arild",
            "3-arild-molle",
            "3a-molle-himmelstorp",
            "4a-kullarulla",
            "4-molle-hoganas",
            "5-hoganas-domsten",
            "6-domsten-helsingborg",
            "6-domsten-helsingborgsofiero",
            "7-helsingborg-rydeback",
            "8-rydeback-landskrona",
            "8-rydeback-landskronaglumslov",
            "9a-ven-runt",
            "9-landskrona-jaravallen",
            "9-landskrona-tide-vindskydd",
            "9-landskrona-jaravallenlandskrona-station",
            "10-jaravallen-loddekopinge",
            "10-loddekopinge",
            "11-loddekopinge-bjarred",
            "12-bjarred-lomma",
            "13-lomma-spillepeng",
            "14-spillepeng-bulltofta",
            "14-arlovburlovs-station",
            "14a-bulltofta",
            "15-bulltofta-malmo-c",
            "16-spillepeng-malmo-c",
            "17-malmo-c-limhamn",
            "18-limhamn-klagshamn",
            "19-klagshamn-falsterbokanalen",
            "19-foteviken",
            "20-falsterbokanalen-skanor",
            "21-skanor-falsterbo",
            "22-falsterbo-falsterbokanalen",
        ],
        "SL6": [
            "1-brosarp-maglehem",
            "2-maglehem-nyehusen",
            "2a-maglehem-degeberga",
            "3-nyehusen-ahus",
            "4a-ahus-runt",
            "4-ahus-kristianstad",
            "5-kristianstad-norra-lingenaset",
            "6-norra-lingenaset-osterslov",
            "7-osterslov-arkelstorp",
            "8-arkelstorp-immeln",
            "8a-arkelstorp-lerjevallen",
            "9-immeln-sibbhult",
            "10-sibbhult-simontorp",
            "10a-sibbhult-breanas",
        ],
        "SL7": [
            "1-ystad-mossbystrand",
            "2-mossbystrand-bingsmarken",
            "3-bingsmarken-smygehamn",
            "4-smygehamn-trelleborg",
            "5-trelleborg-skare",
        ],
    }

    delleder = [
        ("SL1", "Kust till kust"),
        ("SL2", "Nord till syd"),
        ("SL3", "Ås till ås"),
        ("SL4", "Österlen"),
        ("SL5", "Öresund"),
        ("SL6", "Vattenriket"),
        ("SL7", "Sydkust"),
    ]

    results = []
    failed = []

    for trail_code, trail_name in delleder:
        print(f"\n{trail_code} - {trail_name}")

        etapps = known_etapps.get(trail_code, [])
        if not etapps:
            continue

        for etapp_name in etapps:
            etapp_url = f"https://skaneleden.se/etapp/{etapp_name}"
            try:
                print(f"  {etapp_name}...", end=" ", flush=True)

                # Fetch etapp page
                etapp_html = fetch_page(etapp_url)

                # Extract GPX link
                gpx_pattern = r'https://cdn\.hoodin\.com/[^"\'>\s]+\.gpx'
                gpx_matches = re.findall(gpx_pattern, etapp_html, re.IGNORECASE)

                if gpx_matches:
                    gpx_url = gpx_matches[0]
                    filename = gpx_url.split("/")[-1]
                    filepath = output_dir / filename

                    download_file(gpx_url, filepath)

                    results.append(
                        {
                            "trail": trail_code,
                            "trail_name": trail_name,
                            "etapp_url": etapp_url,
                            "etapp_name": etapp_name,
                            "filename": filename,
                            "gpx_url": gpx_url,
                        }
                    )

                    print(f"OK {filename}")
                    time.sleep(0.3)
                else:
                    print("X No GPX found")
                    failed.append(etapp_url)

            except Exception as e:
                print(f"X Error: {e}")
                failed.append(etapp_url)

    # Save mapping CSV
    csv_path = output_dir / "skaneleden_mapping.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["trail", "trail_name", "etapp_name", "filename", "etapp_url", "gpx_url"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{'=' * 60}")
    print(f"Downloaded: {len(results)} GPX files")
    print(f"Failed: {len(failed)}")

    return output_dir, csv_path, len(results)


def _csv_to_trail_files(gpx_dir: Path, csv_path: Path) -> list[dict]:
    """Convert the download mapping CSV to TrailFile entries for the pipeline."""
    mapping = []
    with csv_path.open(encoding="utf-8") as f:
        mapping = list(csv.DictReader(f))

    return [
        {
            "gpx_path": gpx_dir / row["filename"],
            "name": f"{row['trail']} {row['trail_name']}, Etapp: {row['etapp_name']}",
        }
        for row in mapping
    ]


def main() -> None:
    """Main execution."""
    print("\n" + "=" * 60)
    print("Skåneleden Trail Updater")
    print("Downloads, merges, and simplifies official trail GPX files")
    print("=" * 60)

    # Step 1: Download
    gpx_dir, csv_path, download_count = download_trails()

    # Step 2: Merge
    print(f"\n{'=' * 60}")
    print("STEP 2: Merging GPX files")
    print("=" * 60)
    output_file = Path(__file__).parent.parent / "app" / "tracks_gpx" / "planned_hikes" / "all-skane-trails.gpx"
    trail_files = _csv_to_trail_files(gpx_dir, csv_path)
    merge_gpx_files(trail_files, output_file)

    # Step 3: Simplify
    print(f"\n{'=' * 60}")
    print("STEP 3: Simplifying coordinates")
    print("=" * 60)
    final_points, final_size = simplify_gpx(output_file)

    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"Downloaded {download_count} GPX files")
    print(f"Simplified to {final_points:,} points ({final_size:.2f} MB)")
    print(f"\nOutput: {output_file}")
    print("\nNext: Run bootstrap to load trails into Firestore:")
    print(
        "  uv run python -c \"from app.functions.bootstrap_trails import bootstrap_planned_trails; bootstrap_planned_trails('app/tracks_gpx/planned_hikes/all-skane-trails.gpx')\""
    )


if __name__ == "__main__":
    main()
