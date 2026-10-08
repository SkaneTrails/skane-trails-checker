import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trail } from '@/lib/types';

vi.mock('@/lib/api', () => ({ trailsApi: { getTrailChanges: vi.fn() } }));
vi.mock('@/lib/auth-scope', () => ({ currentUserId: () => 'user-1' }));
vi.mock('@/lib/storage/map-trail-store', () => ({
  mapTrailStore: { get: vi.fn(), apply: vi.fn(), clear: vi.fn() },
}));

import { trailsApi } from '@/lib/api';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { syncMapTrails } from '../map-trail-sync';

const getTrailChanges = vi.mocked(trailsApi.getTrailChanges);
const store = vi.mocked(mapTrailStore);
const SCOPE = 'group:g1';

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
    store.clear.mockResolvedValue(undefined);
  });

  it('first sync fetches everything once and stores it for the signed-in user', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null, scope: null });
    getTrailChanges.mockResolvedValue({
      trails: [trail('a'), trail('b')],
      deleted_ids: [],
      server_time: '2026-03-01T12:00:00Z',
      scope: SCOPE,
    });
    const onLocal = vi.fn();

    const result = await syncMapTrails(onLocal);

    expect(store.get).toHaveBeenCalledWith('user-1');
    expect(getTrailChanges).toHaveBeenCalledWith(undefined);
    expect(onLocal).not.toHaveBeenCalled();
    expect(result.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(store.apply).toHaveBeenCalledWith(
      'user-1',
      [trail('a'), trail('b')],
      [],
      { lastSyncTime: '2026-03-01T12:00:00Z', scope: SCOPE },
      { replace: true },
    );
  });

  it('shows the local copy before the network answers', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z', scope: SCOPE });
    const order: string[] = [];
    const onLocal = vi.fn(() => order.push('local'));
    getTrailChanges.mockImplementation(async () => {
      order.push('request');
      return { trails: [], deleted_ids: [], server_time: '2026-03-02T00:00:00Z', scope: SCOPE };
    });

    await syncMapTrails(onLocal);

    expect(onLocal).toHaveBeenCalledWith(local);
    expect(order).toEqual(['local', 'request']);
  });

  it('asks only for changes since the last sync', async () => {
    store.get.mockResolvedValue({
      trails: [trail('a')],
      lastSyncTime: '2026-03-01T00:00:00Z',
      scope: SCOPE,
    });
    getTrailChanges.mockResolvedValue({ trails: [], deleted_ids: [], server_time: 'x', scope: SCOPE });

    await syncMapTrails(vi.fn());

    expect(getTrailChanges).toHaveBeenCalledWith('2026-03-01T00:00:00Z');
  });

  it('returns the very same array and writes nothing when nothing changed', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z', scope: SCOPE });
    getTrailChanges.mockResolvedValue({ trails: [], deleted_ids: [], server_time: 'x', scope: SCOPE });

    const result = await syncMapTrails(vi.fn());

    expect(result).toBe(local);
    expect(store.apply).not.toHaveBeenCalled();
  });

  it('applies changed and deleted trails to the local copy', async () => {
    store.get.mockResolvedValue({
      trails: [trail('a', 'old'), trail('b'), trail('c')],
      lastSyncTime: '2026-03-01T00:00:00Z',
      scope: SCOPE,
    });
    getTrailChanges.mockResolvedValue({
      trails: [trail('a', 'new'), trail('d')],
      deleted_ids: ['b'],
      server_time: '2026-03-02T00:00:00Z',
      scope: SCOPE,
    });

    const result = await syncMapTrails(vi.fn());

    expect(result.map((t) => `${t.trail_id}:${t.name}`).sort()).toEqual(['a:new', 'c:c', 'd:d']);
    expect(store.apply).toHaveBeenCalledWith(
      'user-1',
      [trail('a', 'new'), trail('d')],
      ['b'],
      { lastSyncTime: '2026-03-02T00:00:00Z', scope: SCOPE },
      { replace: false },
    );
  });

  it('records the sync position when the very first sync finds no trails', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null, scope: null });
    getTrailChanges.mockResolvedValue({
      trails: [],
      deleted_ids: [],
      server_time: '2026-03-01T12:00:00Z',
      scope: SCOPE,
    });

    expect(await syncMapTrails(vi.fn())).toEqual([]);
    expect(store.apply).toHaveBeenCalledWith(
      'user-1',
      [],
      [],
      { lastSyncTime: '2026-03-01T12:00:00Z', scope: SCOPE },
      { replace: true },
    );
  });

  it('drops the local copy and fetches everything when the server reports another scope', async () => {
    store.get.mockResolvedValue({
      trails: [trail('old-group-trail')],
      lastSyncTime: '2026-03-01T00:00:00Z',
      scope: 'group:old',
    });
    getTrailChanges
      .mockResolvedValueOnce({
        trails: [],
        deleted_ids: [],
        server_time: '2026-03-02T00:00:00Z',
        scope: 'group:new',
      })
      .mockResolvedValueOnce({
        trails: [trail('new-group-trail')],
        deleted_ids: [],
        server_time: '2026-03-02T00:00:01Z',
        scope: 'group:new',
      });

    const result = await syncMapTrails(vi.fn());

    expect(store.clear).toHaveBeenCalledOnce();
    expect(getTrailChanges).toHaveBeenNthCalledWith(1, '2026-03-01T00:00:00Z');
    expect(getTrailChanges).toHaveBeenNthCalledWith(2);
    expect(result.map((t) => t.trail_id)).toEqual(['new-group-trail']);
    expect(store.apply).toHaveBeenCalledWith(
      'user-1',
      [trail('new-group-trail')],
      [],
      { lastSyncTime: '2026-03-02T00:00:01Z', scope: 'group:new' },
      { replace: true },
    );
  });

  it('replaces the stored copy when the local one was unreadable, since a full snapshot has no tombstones', async () => {
    // The store reports an unreadable copy as empty with no cursor.
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null, scope: null });
    getTrailChanges.mockResolvedValue({
      trails: [trail('still-there')],
      deleted_ids: [],
      server_time: '2026-03-02T00:00:00Z',
      scope: SCOPE,
    });

    await syncMapTrails(vi.fn());

    expect(store.apply).toHaveBeenCalledWith('user-1', [trail('still-there')], [], expect.anything(), {
      replace: true,
    });
  });

  it('stops showing the old scope\'s trails at once, even if the refetch then fails', async () => {
    store.get.mockResolvedValue({
      trails: [trail('old-group-trail')],
      lastSyncTime: '2026-03-01T00:00:00Z',
      scope: 'group:old',
    });
    getTrailChanges
      .mockResolvedValueOnce({
        trails: [],
        deleted_ids: [],
        server_time: '2026-03-02T00:00:00Z',
        scope: 'group:new',
      })
      .mockRejectedValueOnce(new Error('offline'));
    const onLocal = vi.fn();

    await expect(syncMapTrails(onLocal)).rejects.toThrow('offline');

    expect(onLocal).toHaveBeenNthCalledWith(1, [trail('old-group-trail')]);
    expect(onLocal).toHaveBeenLastCalledWith([]);
  });

  it('falls back to the local copy when the request fails', async () => {
    const local = [trail('a')];
    store.get.mockResolvedValue({ trails: local, lastSyncTime: '2026-03-01T00:00:00Z', scope: SCOPE });
    getTrailChanges.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await syncMapTrails(vi.fn())).toBe(local);
  });

  it('throws instead of falling back to the local copy when strict', async () => {
    store.get.mockResolvedValue({
      trails: [trail('a')],
      lastSyncTime: '2026-03-01T00:00:00Z',
      scope: SCOPE,
    });
    getTrailChanges.mockRejectedValue(new Error('offline'));

    await expect(syncMapTrails(vi.fn(), { strict: true })).rejects.toThrow('offline');
  });

  it('throws when the request fails and there is no local copy', async () => {
    store.get.mockResolvedValue({ trails: [], lastSyncTime: null, scope: null });
    getTrailChanges.mockRejectedValue(new Error('offline'));

    await expect(syncMapTrails(vi.fn())).rejects.toThrow('offline');
  });
});
