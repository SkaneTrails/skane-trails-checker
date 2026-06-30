"""Convert raw GPS recording coordinates into Trail and TrailDetails models."""

import hashlib
import math
from datetime import UTC, datetime

from api.models.trail import Coordinate, RecordingCoordinate, TrailBounds, TrailDetailsResponse, TrailResponse
from app.functions.trail_converter import detect_source

_MIN_HORIZ_DIST_M = 1.0
_MS_PER_MINUTE = 60_000


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in km between two coordinates."""
    lat_diff = (lat2 - lat1) * 111.0
    lng_diff = (lng2 - lng1) * 111.0 * math.cos(math.radians(lat1))
    return (lat_diff**2 + lng_diff**2) ** 0.5


def _compute_elevation_metrics(
    coords: list[tuple[float, float]], elevations: list[float]
) -> tuple[float, float, float | None, float | None]:
    """Compute elevation gain, loss, avg/max inclination."""
    gain = 0.0
    loss = 0.0
    inclinations: list[float] = []

    for i in range(len(coords) - 1):
        elev_diff = elevations[i + 1] - elevations[i]
        if elev_diff > 0:
            gain += elev_diff
        else:
            loss += abs(elev_diff)

        lat1, lng1 = coords[i]
        lat2, lng2 = coords[i + 1]
        lat_diff_m = (lat2 - lat1) * 111_000.0
        lng_diff_m = (lng2 - lng1) * 111_000.0 * math.cos(math.radians(lat1))
        horiz_dist = (lat_diff_m**2 + lng_diff_m**2) ** 0.5
        if horiz_dist > _MIN_HORIZ_DIST_M:
            inclinations.append(math.degrees(math.atan2(abs(elev_diff), horiz_dist)))

    avg_incl = round(sum(inclinations) / len(inclinations), 1) if inclinations else None
    max_incl = round(max(inclinations), 1) if inclinations else None
    return round(gain, 1), round(loss, 1), avg_incl, max_incl


def _simplify_coordinates(coords: list[tuple[float, ...]], tolerance: float = 0.00001) -> list[tuple[float, ...]]:
    """Simplify coordinates using RDP algorithm. Falls back to no simplification."""
    try:
        import numpy as np
        from rdp import rdp

        if len(coords) <= 2:  # noqa: PLR2004
            return coords

        has_elevation = len(coords[0]) == 3  # noqa: PLR2004
        points = np.array(coords) if has_elevation else np.array([(lat, lon, 0.0) for lat, lon in coords])

        simplified = rdp(points, epsilon=tolerance)

        if has_elevation:
            return [(lat, lon, elev) for lat, lon, elev in simplified.tolist()]
        return [(lat, lon) for lat, lon, _ in simplified.tolist()]
    except ImportError:  # pragma: no cover
        return coords


def process_recording(
    name: str, coordinates: list[RecordingCoordinate], user_uid: str
) -> tuple[TrailResponse, TrailDetailsResponse]:
    """Convert GPS recording coordinates to Trail + TrailDetails.

    Source is auto-detected from coordinates.
    Returns a (TrailResponse, TrailDetailsResponse) tuple ready for storage.
    """
    all_coords = [(c.lat, c.lng) for c in coordinates]
    source = detect_source(all_coords)
    lats = [c.lat for c in coordinates]
    lngs = [c.lng for c in coordinates]

    # Check for elevation data
    has_elevation = all(c.altitude is not None for c in coordinates)
    elevations = [c.altitude for c in coordinates] if has_elevation else []

    # Build 3D coords for simplification when elevation available
    if has_elevation:
        coords_3d: list[tuple[float, ...]] = [(c.lat, c.lng, c.altitude) for c in coordinates]  # type: ignore[misc]
    else:
        coords_3d = [(c.lat, c.lng) for c in coordinates]

    simplified = _simplify_coordinates(coords_3d)

    # Bounds and center
    bounds = TrailBounds(north=max(lats), south=min(lats), east=max(lngs), west=min(lngs))
    center = Coordinate(lat=sum(lats) / len(lats), lng=sum(lngs) / len(lngs))

    # Length
    length_km = 0.0
    for i in range(len(all_coords) - 1):
        length_km += _haversine_km(*all_coords[i], *all_coords[i + 1])

    # Elevation metrics
    elevation_gain = None
    elevation_loss = None
    avg_inclination_deg = None
    max_inclination_deg = None
    if has_elevation and len(elevations) > 1:
        elevation_gain, elevation_loss, avg_inclination_deg, max_inclination_deg = _compute_elevation_metrics(
            all_coords, elevations
        )  # type: ignore[arg-type]

    # Duration from timestamps
    duration_minutes = None
    if len(coordinates) >= 2:  # noqa: PLR2004
        delta_ms = coordinates[-1].timestamp - coordinates[0].timestamp
        total_minutes = int(delta_ms / _MS_PER_MINUTE)
        if total_minutes > 0:
            duration_minutes = total_minutes

    # Activity date from first timestamp
    activity_date = datetime.fromtimestamp(coordinates[0].timestamp / 1000, tz=UTC).isoformat()

    # Stable trail ID
    first_coord = f"{all_coords[0][0]:.6f},{all_coords[0][1]:.6f}"
    first_ts = str(coordinates[0].timestamp)
    trail_id = hashlib.md5(  # noqa: S324
        f"{source}_{name}_{first_ts}_{first_coord}".encode()
    ).hexdigest()[:12]

    # Build coordinate lists
    if has_elevation:
        coordinates_map = [Coordinate(lat=lat, lng=lng, elevation=elev) for lat, lng, elev in simplified]
        coordinates_full = [Coordinate(lat=c.lat, lng=c.lng, elevation=c.altitude) for c in coordinates]
        elevation_profile = elevations  # type: ignore[assignment]
    else:
        coordinates_map = [Coordinate(lat=lat, lng=lng) for lat, lng in simplified]
        coordinates_full = [Coordinate(lat=c.lat, lng=c.lng) for c in coordinates]
        elevation_profile = None

    now = datetime.now(UTC).isoformat()

    trail = TrailResponse(
        trail_id=trail_id,
        name=name,
        difficulty="Unknown",
        length_km=round(length_km, 2),
        status="Explored!",
        coordinates_map=coordinates_map,
        bounds=bounds,
        center=center,
        source=source,
        last_updated=now,
        activity_date=activity_date,
        activity_type="hiking",
        elevation_gain=elevation_gain,
        elevation_loss=elevation_loss,
        duration_minutes=duration_minutes,
        avg_inclination_deg=avg_inclination_deg,
        max_inclination_deg=max_inclination_deg,
        created_by=user_uid,
    )

    details = TrailDetailsResponse(
        trail_id=trail_id, coordinates_full=coordinates_full, elevation_profile=elevation_profile
    )

    return trail, details
