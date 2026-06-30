/**
 * Reverse geocoding via OpenStreetMap Nominatim (free, no API key).
 *
 * Used to pre-fill trail names based on the GPS coordinates from a
 * recorded hike. Only called once per recording (when user stops).
 */

interface NominatimAddress {
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

function extractPlaceName(address: NominatimAddress): string | null {
  return (
    address.hamlet ??
    address.village ??
    address.town ??
    address.city ??
    address.municipality ??
    address.county ??
    null
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  // User-Agent is forbidden in browsers but required by Nominatim policy on native
  if (typeof navigator === 'undefined' || !('userAgent' in navigator)) {
    headers['User-Agent'] = 'SkaneTrails/1.0';
  }

  const response = await fetch(url, { headers });

  if (!response.ok) return null;

  const data: NominatimResponse = await response.json();
  if (!data.address) return null;

  return extractPlaceName(data.address);
}
