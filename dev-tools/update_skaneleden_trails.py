"""
Download, merge, and simplify Skåneleden trail GPX files.

This script performs three steps:
1. Downloads all GPX files from the official Skåneleden website
2. Merges them into a single all-skane-trails.gpx file with proper names
3. Simplifies the coordinates using RDP algorithm to reduce file size

Usage:
    python update_skaneleden_trails.py
"""

import csv
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

import gpxpy
import gpxpy.gpx
from rdp import rdp


def download_file(url: str, filepath: str | Path) -> bytes:
    """Download a file from URL to filepath."""
    if not url.startswith(("http://", "https://")):
        raise ValueError("URL must start with 'http://' or 'https://'")  # noqa: TRY003, EM101
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=15) as response:  # noqa: S310
        content = response.read()
    with Path(filepath).open("wb") as f:
        f.write(content)
    return content


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


def merge_trails(gpx_dir: Path, csv_path: Path) -> tuple[Path, int]:  # noqa: PLR0915
    """Merge individual GPX files into a single combined file."""
    print(f"\n{'=' * 60}")
    print("STEP 2: Merging GPX files")
    print("=" * 60)

    # Load CSV mapping
    mapping = []
    with Path(csv_path).open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        mapping = list(reader)

    print(f"Found {len(mapping)} GPX files in mapping\n")

    # Create combined GPX
    combined_gpx = gpxpy.gpx.GPX()

    success_count = 0
    fail_count = 0

    for row in mapping:
        trail_code = row["trail"]
        trail_name = row["trail_name"]
        etapp_name = row["etapp_name"]
        filename = row["filename"]

        gpx_file = gpx_dir / filename

        if not gpx_file.exists():
            print(f"✗ {trail_code}: {etapp_name} - File not found")
            fail_count += 1
            continue

        try:
            with gpx_file.open(encoding="utf-8") as f:
                gpx_obj = gpxpy.parse(f)

            # Process tracks
            for track in gpx_obj.tracks:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = f"{trail_code} {trail_name}, Etapp: {etapp_name}"

                for segment in track.segments:
                    new_track.segments.append(segment)

                combined_gpx.tracks.append(new_track)

            # Process routes (convert to tracks)
            for route in gpx_obj.routes:
                new_track = gpxpy.gpx.GPXTrack()
                new_track.name = f"{trail_code} {trail_name}, Etapp: {etapp_name}"

                segment = gpxpy.gpx.GPXTrackSegment()
                for point in route.points:
                    track_point = gpxpy.gpx.GPXTrackPoint(
                        latitude=point.latitude, longitude=point.longitude, elevation=point.elevation, time=point.time
                    )
                    segment.points.append(track_point)

                new_track.segments.append(segment)
                combined_gpx.tracks.append(new_track)

            if not gpx_obj.tracks and not gpx_obj.routes:
                print(f"⚠ {trail_code}: {etapp_name} - No tracks or routes found")
            else:
                print(f"✓ {trail_code}: {etapp_name}")
                success_count += 1

        except Exception as e:
            print(f"✗ {trail_code}: {etapp_name} - Error: {e}")
            fail_count += 1

    # Write combined file
    output_file = Path(__file__).parent.parent / "app" / "tracks_gpx" / "planned_hikes" / "all-skane-trails.gpx"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as f:
        f.write(combined_gpx.to_xml())

    print(f"\n{'=' * 60}")
    print(f"✓ Generated: {output_file}")
    print(f"  Processed: {success_count} files")
    print(f"  Failed: {fail_count} files")
    print(f"  Total tracks: {len(combined_gpx.tracks)}")

    return output_file, len(combined_gpx.tracks)


def simplify_trails(gpx_file: Path, tolerance: float = 0.00005) -> tuple[int, float]:
    """Simplify GPX coordinates using RDP algorithm."""
    print(f"\n{'=' * 60}")
    print("STEP 3: Simplifying coordinates")
    print("=" * 60)

    print(f"Reading {gpx_file}...")
    with gpx_file.open(encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    # Count original points
    original_tracks = len(gpx.tracks)
    original_points = sum(len(segment.points) for track in gpx.tracks for segment in track.segments)

    print(f"Original: {original_tracks} tracks, {original_points:,} points")

    # Simplify each segment
    segments_simplified = 0
    for track in gpx.tracks:
        for segment in track.segments:
            if len(segment.points) < 3:  # noqa: PLR2004
                continue

            # Extract coordinates
            coords = [(p.latitude, p.longitude) for p in segment.points]

            # Apply RDP simplification
            simplified = rdp(coords, epsilon=tolerance)

            # Update segment with simplified points
            new_points = []
            for lat, lon in simplified:
                # Find closest original point to preserve elevation/time
                original_point = min(segment.points, key=lambda p: (p.latitude - lat) ** 2 + (p.longitude - lon) ** 2)
                new_point = gpxpy.gpx.GPXTrackPoint(
                    latitude=lat, longitude=lon, elevation=original_point.elevation, time=original_point.time
                )
                new_points.append(new_point)

            segment.points = new_points
            segments_simplified += 1

    # Count simplified points
    simplified_points = sum(len(segment.points) for track in gpx.tracks for segment in track.segments)

    reduction_pct = ((original_points - simplified_points) / original_points) * 100
    print(f"Simplified: {original_tracks} tracks, {simplified_points:,} points ({reduction_pct:.1f}% reduction)")
    print(f"Simplified {segments_simplified} segments")

    # Write simplified file
    simplified_file = gpx_file.parent / "all-skane-trails-simplified.gpx"
    with simplified_file.open("w", encoding="utf-8") as f:
        f.write(gpx.to_xml())

    # Calculate file sizes
    original_size = gpx_file.stat().st_size / (1024 * 1024)
    simplified_size = simplified_file.stat().st_size / (1024 * 1024)
    size_reduction_pct = ((original_size - simplified_size) / original_size) * 100

    print("\nFile sizes:")
    print(f"  Original: {original_size:.2f} MB")
    print(f"  Simplified: {simplified_size:.2f} MB ({size_reduction_pct:.1f}% reduction)")

    # Replace original with simplified
    simplified_file.replace(gpx_file)
    print(f"\n✓ Replaced {gpx_file.name} with simplified version")

    return simplified_points, simplified_size


def main() -> None:
    """Main execution."""
    print("\n" + "=" * 60)
    print("Skåneleden Trail Updater")
    print("Downloads, merges, and simplifies official trail GPX files")
    print("=" * 60)

    # Step 1: Download
    gpx_dir, csv_path, download_count = download_trails()

    # Step 2: Merge
    output_file, track_count = merge_trails(gpx_dir, csv_path)

    # Step 3: Simplify
    final_points, final_size = simplify_trails(output_file)

    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"✓ Downloaded {download_count} GPX files")
    print(f"✓ Merged into {track_count} tracks")
    print(f"✓ Simplified to {final_points:,} points ({final_size:.2f} MB)")
    print(f"\nOutput: {output_file}")
    print("\nNext: Run the Streamlit app to bootstrap trails to Firestore")


if __name__ == "__main__":
    main()
