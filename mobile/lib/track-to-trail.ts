/**
 * Client-side GPS coordinate processing utilities.
 *
 * Used during live tracking for real-time stats (distance, elevation).
 * Final trail processing happens server-side via POST /trails/record.
 */

import type { Coordinate, TrailBounds } from '@/lib/types';

export interface TrackingPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  timestamp: number;
}

export interface TrackingStats {
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  durationMinutes: number;
  pointCount: number;
  bounds: TrailBounds;
  center: Coordinate;
}

/**
 * Haversine-approximation distance in km between two coordinates.
 * Matches the server-side calculation in trail_converter.py.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const latDiff = (lat2 - lat1) * 111.0;
  const lngDiff = (lng2 - lng1) * 111.0 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

/**
 * Compute total distance in km along a list of tracking points.
 */
export function totalDistanceKm(points: TrackingPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Compute elevation gain and loss from points with altitude data.
 * Returns [gain, loss] in meters. Zero if no altitude data.
 */
export function elevationStats(points: TrackingPoint[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const alt1 = points[i].altitude;
    const alt2 = points[i + 1].altitude;
    if (alt1 == null || alt2 == null) continue;

    const diff = alt2 - alt1;
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }

  return {
    gain: Math.round(gain * 10) / 10,
    loss: Math.round(loss * 10) / 10,
  };
}

/**
 * Compute bounds and center for a set of points.
 */
export function computeBoundsAndCenter(
  points: TrackingPoint[],
): { bounds: TrailBounds; center: Coordinate } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return {
    bounds: {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    },
    center: {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    },
  };
}

/**
 * Compute full tracking statistics from recorded points.
 */
export function computeTrackingStats(points: TrackingPoint[]): TrackingStats {
  const distance = totalDistanceKm(points);
  const elevation = elevationStats(points);
  const { bounds, center } = computeBoundsAndCenter(points);

  let durationMinutes = 0;
  if (points.length >= 2) {
    durationMinutes = Math.floor(
      (points[points.length - 1].timestamp - points[0].timestamp) / 60_000,
    );
  }

  return {
    distanceKm: distance,
    elevationGain: elevation.gain,
    elevationLoss: elevation.loss,
    durationMinutes,
    pointCount: points.length,
    bounds,
    center,
  };
}

/**
 * Convert tracking points to the JSON body for POST /trails/record.
 */
export function toRecordingPayload(
  name: string,
  points: TrackingPoint[],
): {
  name: string;
  coordinates: { lat: number; lng: number; altitude: number | null; timestamp: number }[];
} {
  return {
    name,
    coordinates: points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      altitude: p.altitude,
      timestamp: p.timestamp,
    })),
  };
}
