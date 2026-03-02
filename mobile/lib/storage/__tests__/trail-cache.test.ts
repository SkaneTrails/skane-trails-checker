import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trailCache } from '../../storage/trail-cache';
import type { Trail } from '@/lib/types';

const sampleTrail: Trail = {
  trail_id: 'abc123',
  name: 'Test Trail',
  status: 'To Explore',
  source: 'planned_hikes',
  length_km: 12.5,
  difficulty: 'Unknown',
  coordinates_map: [{ lat: 56.0, lng: 13.5 }],
  bounds: { north: 56.1, south: 55.9, east: 13.6, west: 13.4 },
  center: { lat: 56.0, lng: 13.5 },
  last_updated: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
};

const sampleTrail2: Trail = {
  ...sampleTrail,
  trail_id: 'def456',
  name: 'Second Trail',
};

// Use fake-indexeddb/auto so we can exercise real IndexedDB-backed
// caching behavior and error handling in a consistent test environment.

describe('trailCache', () => {
  beforeEach(async () => {
    await trailCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('returns empty data when cache is empty', async () => {
      const result = await trailCache.get();
      expect(result.trails).toEqual([]);
      expect(result.lastSyncTime).toBeNull();
    });
  });

  describe('set + get roundtrip', () => {
    it('stores and retrieves trails', async () => {
      await trailCache.set([sampleTrail], '2025-06-01T00:00:00Z');
      const result = await trailCache.get();
      expect(result.trails).toEqual([sampleTrail]);
      expect(result.lastSyncTime).toBe('2025-06-01T00:00:00Z');
    });
  });

  describe('merge', () => {
    it('merges new trails into existing cache', async () => {
      await trailCache.set([sampleTrail], '2025-06-01T00:00:00Z');
      const merged = await trailCache.merge([sampleTrail2], '2025-07-01T00:00:00Z');
      expect(merged).toHaveLength(2);
      expect(merged.map((t) => t.trail_id).sort()).toEqual(['abc123', 'def456']);
    });

    it('overwrites existing trail with same id', async () => {
      await trailCache.set([sampleTrail], '2025-06-01T00:00:00Z');
      const updated = { ...sampleTrail, name: 'Updated Name' };
      const merged = await trailCache.merge([updated], '2025-07-01T00:00:00Z');
      expect(merged).toHaveLength(1);
      expect(merged[0].name).toBe('Updated Name');
    });
  });

  describe('clear', () => {
    it('clears all cached data', async () => {
      await trailCache.set([sampleTrail], '2025-06-01T00:00:00Z');
      await trailCache.clear();
      const result = await trailCache.get();
      expect(result.trails).toEqual([]);
      expect(result.lastSyncTime).toBeNull();
    });
  });

  describe('error handling', () => {
    it('returns empty data when indexedDB throws on get', async () => {
      const originalOpen = globalThis.indexedDB?.open;
      if (globalThis.indexedDB) {
        vi.spyOn(globalThis.indexedDB, 'open').mockImplementation(() => {
          throw new Error('DB error');
        });
      }

      const result = await trailCache.get();
      expect(result.trails).toEqual([]);
      expect(result.lastSyncTime).toBeNull();

      if (originalOpen) {
        vi.restoreAllMocks();
      }
    });
  });
});
