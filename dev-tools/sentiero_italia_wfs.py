"""CAI WFS client for Sentiero Italia trail data and POIs.

Fetches tappa metadata, POI layers (bus/train stations, water points, parking,
trail nodes) from the Club Alpino Italiano public WFS service.

Data source: sentieroitaliamappe.cai.it
"""

import json
import math
import re
import urllib.parse
import urllib.request

WFS_BASE = "https://sentieroitaliamappe.cai.it/index.php/lizmap/service?repository=sicaipubblico&project=SICAI_Pubblico"
GPX_BASE = "https://sentieroitalia.cai.it/gpxfiles"

# POI layers available in the CAI WFS service
POI_LAYERS = {
    "Stazioni_bus": {
        "properties": "name,operator,network,route_ref,ele",
        "category_slug": "kollektivtrafik",
        "category_name": "Bus Station",
        "category_icon": "🚌",
    },
    "Stazioni_treni": {
        "properties": "name,operator,network,ele,railway",
        "category_slug": "kollektivtrafik",
        "category_name": "Train Station",
        "category_icon": "🚂",
    },
    "Punti_acqua": {
        "properties": "name,drinking_w,natural",
        "category_slug": "vatten",
        "category_name": "Water Point",
        "category_icon": "💧",
    },
    "Parcheggi": {
        "properties": "name,fclass",
        "category_slug": "parkering",
        "category_name": "Parking",
        "category_icon": "🅿️",
    },
    "Nodi": {
        "properties": "Tappa,Regione,Nome,Quota",
        "category_slug": "nodo",
        "category_name": "Trail Node",
        "category_icon": "📍",
    },
}

# Maximum distance (km) to consider a POI "near" a tappa
NEARBY_RADIUS_KM = 5.0


def _wfs_request(params: dict) -> bytes:
    """Make a WFS request and return response bytes."""
    query = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    url = f"{WFS_BASE}&{query}"
    if not url.startswith("https://"):
        raise ValueError("URL must be HTTPS")  # noqa: TRY003, EM101
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})  # noqa: S310
    with urllib.request.urlopen(req, timeout=60) as response:  # noqa: S310
        return response.read()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in km using Haversine formula."""
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _extract_gpx_url(gpx_html: str) -> str:
    """Extract URL from HTML anchor tag in file_gpx field."""
    if not gpx_html or "href=" not in gpx_html:
        return ""
    match = re.search(r'href="([^"]+)"', gpx_html)
    return match.group(1) if match else ""


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def _extract_centroid(geometry: dict | None) -> tuple[float | None, float | None]:
    """Extract centroid lat/lng from GeoJSON geometry."""
    if not geometry or not geometry.get("coordinates"):
        return None, None

    coords = geometry["coordinates"]
    all_pts: list = []
    if geometry["type"] == "MultiLineString":
        for line in coords:
            all_pts.extend(line)
    elif geometry["type"] == "LineString":
        all_pts = coords

    if not all_pts:
        return None, None

    centroid_lng = sum(p[0] for p in all_pts) / len(all_pts)
    centroid_lat = sum(p[1] for p in all_pts) / len(all_pts)
    return centroid_lat, centroid_lng


def fetch_tappe(regions: list[str] | None = None) -> list[dict]:
    """Fetch all tappa metadata from WFS service.

    Returns list of dicts with full metadata: tappa, regione, km, partenza/arrivo
    with altitudes, elevation gain/loss, difficulty, walkability, signage, notes,
    description, GPX URL, and geometry centroid.
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

        gpx_url = _extract_gpx_url(props.get("file_gpx", ""))
        if not gpx_url and tappa_name:
            encoded_name = urllib.parse.quote(tappa_name)
            gpx_url = f"{GPX_BASE}/{encoded_name}.gpx"

        centroid_lat, centroid_lng = _extract_centroid(feat.get("geometry"))

        tappe.append(
            {
                "tappa": tappa_name,
                "regione": regione,
                "km": props.get("km"),
                "partenza": props.get("partenza", ""),
                "quota_partenza": props.get("quota_part"),
                "arrivo": props.get("arrivo", ""),
                "quota_arrivo": props.get("quota_arri"),
                "elevation_gain": props.get("d+"),
                "elevation_loss": props.get("d-"),
                "difficolta": props.get("difficolta", ""),
                "percorribilita": props.get("percorribilità", ""),
                "segnaletica": props.get("segnaletica", ""),
                "data_aggiornamento": props.get("data", ""),
                "note": _strip_html(props.get("Note", "")),
                "descrizione": _strip_html(props.get("descrizione_sito", "")),
                "openstreetmap_id": props.get("openstreetmap", ""),
                "gpx_url": gpx_url,
                "centroid_lat": centroid_lat,
                "centroid_lng": centroid_lng,
            }
        )

    tappe.sort(key=lambda t: (t["regione"], t["tappa"]))
    print(f"Found {len(tappe)} tappe" + (f" in {', '.join(regions)}" if regions else ""))
    return tappe


def _extract_poi_props(layer_name: str, props: dict) -> dict:
    """Extract layer-specific properties for a POI."""
    poi: dict = {}

    if layer_name == "Stazioni_bus":
        poi["operator"] = props.get("operator") or ""
        poi["network"] = props.get("network") or ""
        poi["route_ref"] = props.get("route_ref") or ""
        poi["ele"] = props.get("ele") or ""
    elif layer_name == "Stazioni_treni":
        poi["operator"] = props.get("operator") or ""
        poi["network"] = props.get("network") or ""
        poi["ele"] = props.get("ele") or ""
        poi["railway"] = props.get("railway") or ""
    elif layer_name == "Punti_acqua":
        poi["drinking_water"] = props.get("drinking_w") or ""
        poi["natural"] = props.get("natural") or ""
    elif layer_name == "Parcheggi":
        poi["fclass"] = props.get("fclass") or ""
    elif layer_name == "Nodi":
        poi["tappa"] = props.get("Tappa") or ""
        poi["regione"] = props.get("Regione") or ""
        poi["quota"] = props.get("Quota")

    return poi


def fetch_pois(layer_name: str) -> list[dict]:
    """Fetch POI features from a WFS layer.

    Returns list of dicts with: name, lat, lng, layer, category info,
    and layer-specific properties.
    """
    config = POI_LAYERS[layer_name]
    print(f"  Fetching {layer_name}...", end=" ", flush=True)
    data = _wfs_request(
        {
            "SERVICE": "WFS",
            "VERSION": "1.0.0",
            "REQUEST": "GetFeature",
            "TYPENAME": layer_name,
            "MAXFEATURES": "10000",
            "OUTPUTFORMAT": "GeoJSON",
            "PROPERTYNAME": config["properties"],
        }
    )
    geojson = json.loads(data)
    features = geojson.get("features", [])

    pois = []
    for feat in features:
        geom = feat.get("geometry")
        if not geom or not geom.get("coordinates"):
            continue

        coords = geom["coordinates"]
        lng, lat = coords[0], coords[1]
        props = feat["properties"]

        name = props.get("name") or props.get("Nome") or ""
        if not name:
            name = config["category_name"]

        poi: dict = {
            "name": name.strip(),
            "lat": lat,
            "lng": lng,
            "layer": layer_name,
            "category_slug": config["category_slug"],
            "category_name": config["category_name"],
            "category_icon": config["category_icon"],
            **_extract_poi_props(layer_name, props),
        }
        pois.append(poi)

    print(f"{len(pois)} features")
    return pois


def fetch_all_pois() -> list[dict]:
    """Fetch all POI layers from WFS service."""
    print("\nFetching POI layers from CAI WFS service...")
    all_pois: list[dict] = []
    for layer_name in POI_LAYERS:
        try:
            pois = fetch_pois(layer_name)
            all_pois.extend(pois)
        except Exception as e:
            print(f"  WARNING: Failed to fetch {layer_name}: {e}")
    print(f"Total POIs fetched: {len(all_pois)}")
    return all_pois


def match_pois_to_tappe(
    tappe: list[dict], pois: list[dict], radius_km: float = NEARBY_RADIUS_KM
) -> dict[str, list[dict]]:
    """Match POIs to tappe by geographic proximity.

    Returns dict mapping tappa name -> list of nearby POIs.
    """
    print(f"\nMatching POIs to tappe (radius: {radius_km} km)...")
    matches: dict[str, list[dict]] = {}

    for tappa in tappe:
        tappa_name = tappa["tappa"]
        clat, clng = tappa.get("centroid_lat"), tappa.get("centroid_lng")
        if clat is None or clng is None:
            continue

        nearby = []
        for poi in pois:
            dist = haversine_km(clat, clng, poi["lat"], poi["lng"])
            if dist <= radius_km:
                nearby.append({**poi, "distance_km": round(dist, 2)})

        if nearby:
            nearby.sort(key=lambda p: p["distance_km"])
            matches[tappa_name] = nearby

    matched_tappe = len(matches)
    total_matches = sum(len(v) for v in matches.values())
    print(f"Matched {total_matches} POIs to {matched_tappe}/{len(tappe)} tappe")
    return matches
