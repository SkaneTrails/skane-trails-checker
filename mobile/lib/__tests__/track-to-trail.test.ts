import type { TrackingPoint } from '@/lib/track-to-trail';
import {
  computeBoundsAndCenter,
  computeTrackingStats,
  elevationStats,
  haversineKm,
  toRecordingPayload,
  totalDistanceKm,
} from '@/lib/track-to-trail';

function makePoint(
  lat: number,
  lng: number,
  altitude: number | null = null,
  timestamp: number = Date.now(),
): TrackingPoint {
  return { lat, lng, altitude, timestamp };
}

describe('haversineKm', () => {
  it('returns zero for same point', () => {
    expect(haversineKm(55.0, 13.0, 55.0, 13.0)).toBe(0);
  });

  it('returns ~111 km for 1 degree latitude', () => {
    const dist = haversineKm(55.0, 13.0, 56.0, 13.0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it('longitude distance varies with latitude', () => {
    const equator = haversineKm(0, 0, 0, 1);
    const sweden = haversineKm(55, 13, 55, 14);
    expect(equator).toBeGreaterThan(sweden);
  });
});

describe('totalDistanceKm', () => {
  it('returns zero for single point', () => {
    expect(totalDistanceKm([makePoint(55, 13)])).toBe(0);
  });

  it('sums distances for multiple points', () => {
    const points = [
      makePoint(55.0, 13.0),
      makePoint(55.001, 13.0),
      makePoint(55.002, 13.0),
    ];
    const dist = totalDistanceKm(points);
    expect(dist).toBeGreaterThan(0.2);
    expect(dist).toBeLessThan(0.3);
  });
});

describe('elevationStats', () => {
  it('returns zero for flat terrain', () => {
    const points = [
      makePoint(55.0, 13.0, 100),
      makePoint(55.001, 13.0, 100),
    ];
    const result = elevationStats(points);
    expect(result.gain).toBe(0);
    expect(result.loss).toBe(0);
  });

  it('calculates gain and loss', () => {
    const points = [
      makePoint(55.0, 13.0, 100),
      makePoint(55.001, 13.0, 200),
      makePoint(55.002, 13.0, 150),
    ];
    const result = elevationStats(points);
    expect(result.gain).toBe(100);
    expect(result.loss).toBe(50);
  });

  it('handles null altitude', () => {
    const points = [
      makePoint(55.0, 13.0, null),
      makePoint(55.001, 13.0, null),
    ];
    const result = elevationStats(points);
    expect(result.gain).toBe(0);
    expect(result.loss).toBe(0);
  });
});

describe('computeBoundsAndCenter', () => {
  it('computes correct bounds', () => {
    const points = [
      makePoint(55.0, 13.0),
      makePoint(55.5, 13.5),
      makePoint(55.2, 13.2),
    ];
    const { bounds, center } = computeBoundsAndCenter(points);
    expect(bounds.north).toBe(55.5);
    expect(bounds.south).toBe(55.0);
    expect(bounds.east).toBe(13.5);
    expect(bounds.west).toBe(13.0);
    expect(center.lat).toBeCloseTo(55.233, 2);
    expect(center.lng).toBeCloseTo(13.233, 2);
  });
});

describe('computeTrackingStats', () => {
  it('computes full stats', () => {
    const baseTime = 1700000000000;
    const points = [
      makePoint(55.6, 13.0, 50, baseTime),
      makePoint(55.601, 13.0, 60, baseTime + 60000),
      makePoint(55.602, 13.0, 55, baseTime + 120000),
    ];
    const stats = computeTrackingStats(points);
    expect(stats.distanceKm).toBeGreaterThan(0);
    expect(stats.elevationGain).toBe(10);
    expect(stats.elevationLoss).toBe(5);
    expect(stats.durationMinutes).toBe(2);
    expect(stats.pointCount).toBe(3);
    expect(stats.bounds.north).toBe(55.602);
    expect(stats.bounds.south).toBe(55.6);
  });

  it('returns zero duration for single point', () => {
    const stats = computeTrackingStats([makePoint(55, 13, 100, 1700000000000)]);
    expect(stats.durationMinutes).toBe(0);
  });
});

describe('toRecordingPayload', () => {
  it('creates correct payload', () => {
    const points = [
      makePoint(55.0, 13.0, 100, 1700000000000),
      makePoint(55.1, 13.1, 200, 1700000060000),
    ];
    const payload = toRecordingPayload('My Hike', points);
    expect(payload.name).toBe('My Hike');
    expect(payload.coordinates).toHaveLength(2);
    expect(payload.coordinates[0].lat).toBe(55.0);
    expect(payload.coordinates[0].altitude).toBe(100);
    expect(payload.coordinates[0].timestamp).toBe(1700000000000);
  });

  it('does not include source in payload', () => {
    const points = [makePoint(55, 13), makePoint(55.1, 13.1)];
    const payload = toRecordingPayload('Hike', points);
    expect(payload).not.toHaveProperty('source');
  });
});
