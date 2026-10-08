import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trail } from '@/lib/types';

// In-memory stand-in for expo-file-system's File/Directory.
const files = new Map<string, string>();
const directories = new Set<string>();
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
    failWrites = false;
  });

  it('is empty before the first sync', async () => {
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });

  it('stores one file per trail plus an index', async () => {
    await mapTrailStore.apply([trail('a'), trail('b')], [], '2026-03-01T00:00:00Z');
    expect([...files.keys()].sort()).toEqual([
      'doc/map-trails/a.json',
      'doc/map-trails/b.json',
      'doc/map-trails/index.json',
    ]);
    const stored = await mapTrailStore.get();
    expect(stored.trails.map((t) => t.trail_id)).toEqual(['a', 'b']);
    expect(stored.lastSyncTime).toBe('2026-03-01T00:00:00Z');
  });

  it('rewrites only the changed trails and deletes removed ones', async () => {
    await mapTrailStore.apply([trail('a', 'old'), trail('b')], [], '2026-03-01T00:00:00Z');
    const untouched = files.get('doc/map-trails/b.json');

    await mapTrailStore.apply([trail('a', 'new')], ['b'], '2026-03-02T00:00:00Z');

    expect(files.has('doc/map-trails/b.json')).toBe(false);
    expect(untouched).toBeDefined();
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

  it('escapes trail ids that are not safe file names', async () => {
    await mapTrailStore.apply([trail('a/b')], [], '2026-03-01T00:00:00Z');
    expect(files.has('doc/map-trails/a%2Fb.json')).toBe(true);
    expect((await mapTrailStore.get()).trails[0].trail_id).toBe('a/b');
  });

  it('treats a missing trail file as an empty store so the next sync is full', async () => {
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    files.delete('doc/map-trails/a.json');
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });

  it('treats a corrupt index as an empty store', async () => {
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    files.set('doc/map-trails/index.json', '{not json');
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });

  it('recovers when the index is corrupt on the next write', async () => {
    directories.add('doc/map-trails');
    files.set('doc/map-trails/index.json', '{not json');
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    expect((await mapTrailStore.get()).trails.map((t) => t.trail_id)).toEqual(['a']);
  });

  it('does not throw when writing fails', async () => {
    failWrites = true;
    await expect(mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z')).resolves.toBeUndefined();
  });

  it('clear removes everything', async () => {
    await mapTrailStore.apply([trail('a')], [], '2026-03-01T00:00:00Z');
    await mapTrailStore.clear();
    expect(files.size).toBe(0);
    expect(await mapTrailStore.get()).toEqual({ trails: [], lastSyncTime: null });
  });
});
