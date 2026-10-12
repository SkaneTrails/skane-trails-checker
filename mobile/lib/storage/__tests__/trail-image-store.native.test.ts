import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrailImage } from '@/lib/types';

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

import { trailImageStore } from '../trail-image-store.native';

const image = (data: string): TrailImage => ({ image_data: data, role: 'primary', caption: null });

describe('trailImageStore (native / files)', () => {
  beforeEach(() => {
    files.clear();
    directories.clear();
    failWrites = false;
  });

  it('has nothing for a trail that was never stored', async () => {
    expect(await trailImageStore.get('u1', 't1')).toBeNull();
  });

  it('stores one file per trail with the revision', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);

    expect([...files.keys()]).toEqual(['doc/trail-images/t1.json']);
    expect(await trailImageStore.get('u1', 't1')).toEqual({ revision: 'rev-1', images: [image('a')] });
  });

  it('a newer revision replaces the older one', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't1', 'rev-2', [image('b')]);

    expect((await trailImageStore.get('u1', 't1'))?.revision).toBe('rev-2');
  });

  it("does not hand one user's photos to another, and deletes the file", async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('private')]);

    expect(await trailImageStore.get('u2', 't1')).toBeNull();
    expect(files.size).toBe(0);
  });

  it('escapes trail ids that are not safe file names', async () => {
    await trailImageStore.put('u1', 'a/b', 'rev-1', [image('a')]);

    expect(files.has('doc/trail-images/a%2Fb.json')).toBe(true);
    expect((await trailImageStore.get('u1', 'a/b'))?.images).toEqual([image('a')]);
  });

  it('treats an unreadable file as missing', async () => {
    directories.add('doc/trail-images');
    files.set('doc/trail-images/t1.json', '{not json');

    expect(await trailImageStore.get('u1', 't1')).toBeNull();
  });

  it('does not throw when writing fails', async () => {
    failWrites = true;

    await expect(trailImageStore.put('u1', 't1', 'rev-1', [image('a')])).resolves.toBeUndefined();
  });

  it('remove forgets one trail only', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't2', 'rev-1', [image('b')]);

    await trailImageStore.remove('t1');

    expect(await trailImageStore.get('u1', 't1')).toBeNull();
    expect(await trailImageStore.get('u1', 't2')).not.toBeNull();
  });

  it('remove of a trail that is not stored is fine', async () => {
    await expect(trailImageStore.remove('nope')).resolves.toBeUndefined();
  });

  it('clear forgets every trail', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.clear();

    expect(files.size).toBe(0);
    expect(await trailImageStore.get('u1', 't1')).toBeNull();
  });
});
