import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const SYNC = { lastSyncTime: '2026-03-01T00:00:00Z', scope: 'group:g1' };

  beforeEach(async () => {
    await mapTrailStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is empty before the first sync', async () => {
    expect(await mapTrailStore.get('u1')).toEqual({ trails: [], lastSyncTime: null, scope: null });
  });

  it('stores trails with the sync position', async () => {
    await mapTrailStore.apply('u1', [trail('a'), trail('b')], [], SYNC);
    const stored = await mapTrailStore.get('u1');
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(stored.lastSyncTime).toBe('2026-03-01T00:00:00Z');
    expect(stored.scope).toBe('group:g1');
  });

  it('applies a delta: replaces changed trails and removes deleted ones', async () => {
    await mapTrailStore.apply('u1', [trail('a', 'old'), trail('b')], [], SYNC);
    await mapTrailStore.apply('u1', [trail('a', 'new')], ['b'], {
      lastSyncTime: '2026-03-02T00:00:00Z',
      scope: 'group:g1',
    });
    const stored = await mapTrailStore.get('u1');
    expect(stored.trails).toHaveLength(1);
    expect(stored.trails[0].name).toBe('new');
    expect(stored.lastSyncTime).toBe('2026-03-02T00:00:00Z');
  });

  it('keeps the previous sync position when none is given', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    await mapTrailStore.apply('u1', [trail('b')], []);
    const stored = await mapTrailStore.get('u1');
    expect(stored.lastSyncTime).toBe('2026-03-01T00:00:00Z');
    expect(stored.scope).toBe('group:g1');
  });

  it('erases the copy when another user asks for it', async () => {
    await mapTrailStore.apply('u1', [trail('private')], [], SYNC);

    expect(await mapTrailStore.get('u2')).toEqual({ trails: [], lastSyncTime: null, scope: null });
    // ...and it is gone for the first user too, not just hidden from the second.
    expect(await mapTrailStore.get('u1')).toEqual({ trails: [], lastSyncTime: null, scope: null });
  });

  it('starts from nothing when applying for a different user than the stored one', async () => {
    await mapTrailStore.apply('u1', [trail('private')], [], SYNC);
    await mapTrailStore.apply('u2', [trail('mine')], [], { ...SYNC, scope: 'group:g2' });

    const stored = await mapTrailStore.get('u2');
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['mine']);
    expect(stored.scope).toBe('group:g2');
  });

  it('changes all stored keys in a single transaction, so a failure cannot leave trails and cursor apart', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');

    await mapTrailStore.apply('u1', [trail('b')], [], { ...SYNC, lastSyncTime: '2026-03-02T00:00:00Z' });

    const writes = transaction.mock.calls.filter(([, mode]) => mode === 'readwrite');
    expect(writes).toHaveLength(1);
  });

  it('clears trails and cursor in a single transaction', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');

    await mapTrailStore.clear();

    const writes = transaction.mock.calls.filter(([, mode]) => mode === 'readwrite');
    expect(writes).toHaveLength(1);
    expect(await mapTrailStore.get('u1')).toEqual({ trails: [], lastSyncTime: null, scope: null });
  });

  it('clear empties the store', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    await mapTrailStore.clear();
    expect(await mapTrailStore.get('u1')).toEqual({ trails: [], lastSyncTime: null, scope: null });
  });
});
