import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TrailImage } from '@/lib/types';
import { trailImageStore } from '../trail-image-store';

const image = (data: string): TrailImage => ({ image_data: data, role: 'primary', caption: null });

describe('trailImageStore (web / IndexedDB)', () => {
  beforeEach(async () => {
    await trailImageStore.clear();
  });

  it('has nothing for a trail that was never stored', async () => {
    expect(await trailImageStore.get('u1', 't1')).toBeNull();
  });

  it('stores photos with their revision', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a'), image('b')]);

    expect(await trailImageStore.get('u1', 't1')).toEqual({
      revision: 'rev-1',
      images: [image('a'), image('b')],
    });
  });

  it('a newer revision replaces the older one', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't1', 'rev-2', [image('b')]);

    expect((await trailImageStore.get('u1', 't1'))?.revision).toBe('rev-2');
  });

  it('keeps trails apart', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't2', 'rev-9', [image('z')]);

    expect((await trailImageStore.get('u1', 't1'))?.images).toEqual([image('a')]);
    expect((await trailImageStore.get('u1', 't2'))?.images).toEqual([image('z')]);
  });

  it("does not hand one user's photos to another, and deletes them", async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('private')]);

    expect(await trailImageStore.get('u2', 't1')).toBeNull();
    expect(await trailImageStore.get('u1', 't1')).toBeNull();
  });

  it('remove forgets one trail only', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't2', 'rev-1', [image('b')]);

    await trailImageStore.remove('t1');

    expect(await trailImageStore.get('u1', 't1')).toBeNull();
    expect(await trailImageStore.get('u1', 't2')).not.toBeNull();
  });

  it('clear forgets every trail', async () => {
    await trailImageStore.put('u1', 't1', 'rev-1', [image('a')]);
    await trailImageStore.put('u1', 't2', 'rev-1', [image('b')]);

    await trailImageStore.clear();

    expect(await trailImageStore.get('u1', 't1')).toBeNull();
    expect(await trailImageStore.get('u1', 't2')).toBeNull();
  });

  it('clear leaves the map trail keys alone', async () => {
    const { mapTrailStore } = await import('../map-trail-store');
    await mapTrailStore.apply('u1', [], [], { lastSyncTime: '2026-03-01T00:00:00Z', scope: 'all' });

    await trailImageStore.clear();

    expect((await mapTrailStore.get('u1')).lastSyncTime).toBe('2026-03-01T00:00:00Z');
  });
});
