import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trail } from '@/lib/types';

vi.mock('@/lib/api', () => ({ trailsApi: { getTrailChanges: vi.fn() } }));
vi.mock('@/lib/storage/map-trail-store', () => ({
  mapTrailStore: { get: vi.fn(), apply: vi.fn() },
}));

import { trailsApi } from '@/lib/api';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { syncMapTrails } from '../map-trail-sync';

const getTrailChanges = vi.mocked(trailsApi.getTrailChanges);
const store = vi.mocked(mapTrailStore);

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

describe('syncMapTrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.apply.mockResolvedValue(undefined);
  });

  it('first sync fetches everything once and stores it', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null });
    getTrailChanges.mockResolvedValue({
      trails: [trail('a'), trail('b')],
      deleted_ids: [],
      server_time: '2026-03-01T12:00:00Z',
    });
    const onLocal = vi.fn();

    const result = await syncMapTrails(onLocal);

    expect(getTrailChanges).toHaveBeenCalledWith(undefined);
    expect(onLocal).not.toHaveBeenCalled();
    expect(result.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(store.apply).toHaveBeenCalledWith(
      [trail('a'), trail('b')],
      [],
      '2026-03-01T12:00:00Z',
    );
  });

  it('shows the local copy before the network answers', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z' });
    const order: string[] = [];
    const onLocal = vi.fn(() => order.push('local'));
    getTrailChanges.mockImplementation(async () => {
      order.push('request');
      return { trails: [], deleted_ids: [], server_time: '2026-03-02T00:00:00Z' };
    });

    await syncMapTrails(onLocal);

    expect(onLocal).toHaveBeenCalledWith(local);
    expect(order).toEqual(['local', 'request']);
  });

  it('asks only for changes since the last sync', async () => {
    store.get.mockResolvedValue({ trails: [trail('a')], lastSyncTime: '2026-03-01T00:00:00Z' });
    getTrailChanges.mockResolvedValue({ trails: [], deleted_ids: [], server_time: 'x' });

    await syncMapTrails(vi.fn());

    expect(getTrailChanges).toHaveBeenCalledWith('2026-03-01T00:00:00Z');
  });

  it('returns the very same array and writes nothing when nothing changed', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z' });
    getTrailChanges.mockResolvedValue({ trails: [], deleted_ids: [], server_time: 'x' });

    const result = await syncMapTrails(vi.fn());

    expect(result).toBe(local);
    expect(store.apply).not.toHaveBeenCalled();
  });

  it('applies changed and deleted trails to the local copy', async () => {
    store.get.mockResolvedValue({
      trails: [trail('a', 'old'), trail('b'), trail('c')],
      lastSyncTime: '2026-03-01T00:00:00Z',
    });
    getTrailChanges.mockResolvedValue({
      trails: [trail('a', 'new'), trail('d')],
      deleted_ids: ['b'],
      server_time: '2026-03-02T00:00:00Z',
    });

    const result = await syncMapTrails(vi.fn());

    expect(result.map((t) => `${t.trail_id}:${t.name}`).sort()).toEqual(['a:new', 'c:c', 'd:d']);
    expect(store.apply).toHaveBeenCalledWith(
      [trail('a', 'new'), trail('d')],
      ['b'],
      '2026-03-02T00:00:00Z',
    );
  });

  it('records the sync time when the very first sync finds no trails', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null });
    getTrailChanges.mockResolvedValue({
      trails: [],
      deleted_ids: [],
      server_time: '2026-03-01T12:00:00Z',
    });

    expect(await syncMapTrails(vi.fn())).toEqual([]);
    expect(store.apply).toHaveBeenCalledWith([], [], '2026-03-01T12:00:00Z');
  });

  it('falls back to the local copy when the request fails', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z' });
    getTrailChanges.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await syncMapTrails(vi.fn())).toBe(local);
  });

  it('throws when the request fails and there is no local copy', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null });
    getTrailChanges.mockRejectedValue(new Error('offline'));

    await expect(syncMapTrails(vi.fn())).rejects.toThrow('offline');
  });
});
