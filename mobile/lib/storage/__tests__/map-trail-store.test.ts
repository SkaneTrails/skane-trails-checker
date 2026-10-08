import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Trail } from '@/lib/types';
import { mapTrailStore } from '../map-trail-store';

const trail = (id: string, name = id): Trail => ({
  trail_id: id,
  name,
  status: 'To Explore',
  source: 'other_trails',
  length_km: 1,
  difficulty: 'Easy',
  coordinates_map: [{ lat: 56, lng: 13 }],
  bounds: { north: 1, south: 0, east: 1, west: 0 },
  center: { lat: 0, lng: 0 },
  last_updated: '2026-01-01T00:00:00Z',
});

describe('mapTrailStore (web / IndexedDB)', () => {
  beforeEach(async () => {
    await mapTrailStore.clear();
  });

  it('is empty before the first sync', async () => {
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });

  it('stores trails with the sync time', async () => {
    await mapTrailStore.apply([trail('a'), trail('b')], [], '2026-03-01T00:00:00Z');
    const stored = await mapTrailStore.get();
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(stored.lastSyncTime).toBe('2026-03-01T00:00:00Z');
  });

  it('applies a delta: replaces changed trails and removes deleted ones', async () => {
    await mapTrailStore.apply([trail('a', 'old'), trail('b')], [], '2026-03-01T00:00:00Z');
    await mapTrailStore.apply([trail('a', 'new')], ['b'], '2026-03-02T00:00:00Z');
    const stored = await mapTrailStore.get();
    expect(stored.trails).toHaveLength(1);
    expect(stored.trails[0].name).toBe('new');
    expect(stored.lastSyncTime).toBe('2026-03-02T00:00:00Z');
  });

  it('keeps the previous sync time when none is given', async () => {
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    await mapTrailStore.apply([trail('b')], []);
    expect((await mapTrailStore.get()).lastSyncTime).toBe('2026-03-01T00:00:00Z');
  });

  it('clear empties the store', async () => {
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    await mapTrailStore.clear();
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });
});
