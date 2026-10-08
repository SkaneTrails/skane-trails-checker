import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trail } from '@/lib/types';

// In-memory stand-in for expo-file-system's File/Directory.
const files = new Map<string, string>();
const directories = new Set<string>();
const removals: string[] = [];
let failWrites = false;

vi.mock('expo-file-system', () => {
  const join = (parent: { path: string } | string, name: string) =>
    `${typeof parent === 'string' ? parent : parent.path}/${name}`;
  class Directory {
    path: string;
    constructor(parent: { path: string } | string, name: string) {
      this.path = join(parent, name);
    }
    get exists() {
      return directories.has(this.path);
    }
    create() {
      directories.add(this.path);
    }
    delete() {
      removals.push(`dir:${this.path}`);
      directories.delete(this.path);
      for (const key of [...files.keys()]) if (key.startsWith(`${this.path}/`)) files.delete(key);
    }
  }
  class File {
    path: string;
    constructor(parent: { path: string } | string, name: string) {
      this.path = join(parent, name);
    }
    get exists() {
      return files.has(this.path);
    }
    async text() {
      const content = files.get(this.path);
      if (content === undefined) throw new Error('missing file');
      return content;
    }
    write(content: string) {
      if (failWrites) throw new Error('disk full');
      files.set(this.path, content);
    }
    delete() {
      removals.push(`file:${this.path}`);
      files.delete(this.path);
    }
  }
  return { Directory, File, Paths: { document: 'doc' } };
});

import { mapTrailStore } from '../map-trail-store.native';

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

describe('mapTrailStore (native / files)', () => {
  beforeEach(() => {
    files.clear();
    directories.clear();
    removals.length = 0;
    failWrites = false;
  });

  const SYNC = { lastSyncTime: '2026-03-01T00:00:00Z', scope: 'group:g1' };
  const EMPTY = { trails: [], lastSyncTime: null, scope: null };

  it('is empty before the first sync', async () => {
    expect(await mapTrailStore.get('u1')).toEqual(EMPTY);
  });

  it('stores one file per trail plus an index', async () => {
    await mapTrailStore.apply('u1', [trail('a'), trail('b')], [], SYNC);
    expect([...files.keys()].sort()).toEqual([
      'doc/map-trails/a.json',
      'doc/map-trails/b.json',
      'doc/map-trails/index.json',
    ]);
    const stored = await mapTrailStore.get('u1');
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(stored.lastSyncTime).toBe('2026-03-01T00:00:00Z');
    expect(stored.scope).toBe('group:g1');
  });

  it('rewrites only the changed trails and deletes removed ones', async () => {
    await mapTrailStore.apply('u1', [trail('a', 'old'), trail('b')], [], SYNC);
    const untouched = files.get('doc/map-trails/b.json');

    await mapTrailStore.apply('u1', [trail('a', 'new')], ['b'], {
      lastSyncTime: '2026-03-02T00:00:00Z',
      scope: 'group:g1',
    });

    expect(files.has('doc/map-trails/b.json')).toBe(false);
    expect(untouched).toBeDefined();
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

    expect(await mapTrailStore.get('u2')).toEqual(EMPTY);
    expect(files.size).toBe(0);
  });

  it('removes the index before anything else so a failed erase never leaves a usable stale copy', async () => {
    await mapTrailStore.apply('u1', [trail('private')], [], SYNC);
    removals.length = 0;

    await mapTrailStore.get('u2');

    expect(removals[0]).toBe('file:doc/map-trails/index.json');
    expect(removals).toContain('dir:doc/map-trails');
  });

  it('starts from nothing when applying for a different user than the stored one', async () => {
    await mapTrailStore.apply('u1', [trail('private')], [], SYNC);
    await mapTrailStore.apply('u2', [trail('mine')], [], { ...SYNC, scope: 'group:g2' });

    const stored = await mapTrailStore.get('u2');
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['mine']);
    expect(stored.scope).toBe('group:g2');
    expect(files.has('doc/map-trails/private.json')).toBe(false);
  });

  it('escapes trail ids that are not safe file names', async () => {
    await mapTrailStore.apply('u1', [trail('a/b')], [], SYNC);
    expect(files.has('doc/map-trails/a%2Fb.json')).toBe(true);
    expect((await mapTrailStore.get('u1')).trails[0].trail_id).toBe('a/b');
  });

  it('treats a missing trail file as an empty store so the next sync is full', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    files.delete('doc/map-trails/a.json');
    expect(await mapTrailStore.get('u1')).toEqual(EMPTY);
  });

  it('treats a corrupt index as an empty store', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    files.set('doc/map-trails/index.json', '{not json');
    expect(await mapTrailStore.get('u1')).toEqual(EMPTY);
  });

  it('recovers when the index is corrupt on the next write', async () => {
    directories.add('doc/map-trails');
    files.set('doc/map-trails/index.json', '{not json');
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    expect((await mapTrailStore.get('u1')).trails.map((t) => t.trail_id)).toEqual(['a']);
  });

  it('does not throw when writing fails', async () => {
    failWrites = true;
    await expect(mapTrailStore.apply('u1', [trail('a')], [], SYNC)).resolves.toBeUndefined();
  });

  it('clear removes everything', async () => {
    await mapTrailStore.apply('u1', [trail('a')], [], SYNC);
    await mapTrailStore.clear();
    expect(files.size).toBe(0);
    expect(await mapTrailStore.get('u1')).toEqual(EMPTY);
  });
});
