import { describe, expect, it } from 'vitest';
import { buildRibbonGeometry } from '../elevation-ribbon-geometry';
import type { Coordinate } from '@/lib/types';

describe('buildRibbonGeometry', () => {
  const skaneTrail: Coordinate[] = [
    { lat: 55.7, lng: 13.2, elevation: 50 },
    { lat: 55.71, lng: 13.21, elevation: 100 },
    { lat: 55.72, lng: 13.22, elevation: 75 },
    { lat: 55.73, lng: 13.23, elevation: 120 },
  ];

  const worldTrail: Coordinate[] = [
    { lat: 35.0, lng: 135.0, elevation: 200 },
    { lat: 35.01, lng: 135.01, elevation: 600 },
    { lat: 35.02, lng: 135.02, elevation: 400 },
  ];

  it('returns null for fewer than 2 coordinates with elevation', () => {
    expect(buildRibbonGeometry([])).toBeNull();
    expect(buildRibbonGeometry([{ lat: 55.7, lng: 13.2, elevation: 50 }])).toBeNull();
  });

  it('returns null when no coordinates have elevation', () => {
    const noEle: Coordinate[] = [
      { lat: 55.7, lng: 13.2 },
      { lat: 55.71, lng: 13.21 },
    ];
    expect(buildRibbonGeometry(noEle)).toBeNull();
  });

  it('produces correct vertex count (2 per coordinate)', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    // 4 points × 2 verts × 3 floats = 24
    expect(result.positions.length).toBe(4 * 2 * 3);
  });

  it('produces correct index count ((n-1) * 6)', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    // (4-1) * 6 = 18
    expect(result.indices.length).toBe(18);
  });

  it('elevation factors range from 0 to 1', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    const factors = Array.from(result.elevationFactors);
    expect(Math.min(...factors)).toBe(0);
    expect(Math.max(...factors)).toBeCloseTo(1, 5);
  });

  it('bottom vertices have elevation factor 0', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    const n = skaneTrail.length;
    for (let i = 0; i < n; i++) {
      expect(result.elevationFactors[i * 2]).toBe(0); // bottom vertex
    }
  });

  it('bottom vertices have y=0 (ground level)', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    const n = skaneTrail.length;
    for (let i = 0; i < n; i++) {
      expect(result.positions[i * 6 + 1]).toBe(0); // y of bottom vertex
    }
  });

  it('top vertices have y > 0 (elevated)', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    const n = skaneTrail.length;
    // The first point has min elevation (50m) so its top vertex y = 0
    // Others should be > 0
    let anyPositive = false;
    for (let i = 0; i < n; i++) {
      if (result.positions[i * 6 + 4] > 0) anyPositive = true;
    }
    expect(anyPositive).toBe(true);
  });

  it('center is within geometry bounds', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    // center should be somewhere in the projected center — just check it's finite
    expect(Number.isFinite(result.center[0])).toBe(true);
    expect(Number.isFinite(result.center[1])).toBe(true);
    expect(Number.isFinite(result.center[2])).toBe(true);
  });

  it('projectedSize has positive width and height', () => {
    const result = buildRibbonGeometry(skaneTrail)!;
    expect(result.projectedSize[0]).toBeGreaterThan(0);
    expect(result.projectedSize[1]).toBeGreaterThan(0);
  });

  it('caps exaggeration for steep world trails', () => {
    const result = buildRibbonGeometry(worldTrail)!;
    // Max height should not exceed 30% of horizontal span
    const n = worldTrail.length;
    let maxY = 0;
    for (let i = 0; i < n; i++) {
      const y = result.positions[i * 6 + 4]; // top vertex y
      if (y > maxY) maxY = y;
    }
    // Calculate horizontal span from positions
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = result.positions[i * 6];
      const z = result.positions[i * 6 + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const horizontalSpan = Math.max(maxX - minX, maxZ - minZ);
    // Allow some floating point tolerance
    expect(maxY).toBeLessThanOrEqual(horizontalSpan * 0.30 + 1);
  });

  it('uses Skåne scale for trails within Skåne bounds', () => {
    // A trail with only 10m elevation range should still get exaggerated in Skåne
    const flatSkane: Coordinate[] = [
      { lat: 55.7, lng: 13.2, elevation: 50 },
      { lat: 55.71, lng: 13.21, elevation: 55 },
      { lat: 55.72, lng: 13.22, elevation: 60 },
    ];
    const result = buildRibbonGeometry(flatSkane)!;
    // Top vertex of last point (highest) should have some height
    const lastTopY = result.positions[(flatSkane.length - 1) * 6 + 4];
    expect(lastTopY).toBeGreaterThan(0);
  });

  it('filters coordinates without elevation', () => {
    const mixed: Coordinate[] = [
      { lat: 55.7, lng: 13.2, elevation: 50 },
      { lat: 55.705, lng: 13.205 }, // no elevation
      { lat: 55.71, lng: 13.21, elevation: 100 },
      { lat: 55.715, lng: 13.215 }, // no elevation
      { lat: 55.72, lng: 13.22, elevation: 75 },
    ];
    const result = buildRibbonGeometry(mixed)!;
    // Should only use 3 points (those with elevation)
    expect(result.positions.length).toBe(3 * 2 * 3);
  });

  it('handles zero horizontal span (vertical-only trail)', () => {
    // All points at same lat/lng but different elevations → horizontalSpan falls back to totalDist
    const vertical: Coordinate[] = [
      { lat: 55.7, lng: 13.2, elevation: 0 },
      { lat: 55.7, lng: 13.2, elevation: 50 },
      { lat: 55.7, lng: 13.2, elevation: 100 },
    ];
    const result = buildRibbonGeometry(vertical)!;
    expect(result).not.toBeNull();
    expect(result.positions.length).toBe(3 * 2 * 3);
  });
});
