/**
 * Local copy of each trail's photos (web, IndexedDB).
 *
 * A copy is only used while its revision equals the trail's `images_revision`, so photos are
 * downloaded once and again only after they change. Each entry records its owner (the signed-in
 * user); another user's entry reads as missing and is deleted.
 */
import type { TrailImage } from '@/lib/types';
import { deleteAll, getFromStore, keysWithPrefix, openDb, putAll } from './idb';
import { createSerialQueue } from './serial-queue';

export interface CachedTrailImages {
  revision: string;
  images: TrailImage[];
}

interface StoredEntry extends CachedTrailImages {
  ownerUid: string;
}

const KEY_PREFIX = 'trailImages:';
const keyFor = (trailId: string) => `${KEY_PREFIX}${trailId}`;

async function withDb<T>(fallback: T, operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
  let db: IDBDatabase | undefined;
  try {
    db = await openDb();
    return await operation(db);
  } catch {
    return fallback;
  } finally {
    db?.close();
  }
}

const unqueuedStore = {
  get(ownerUid: string, trailId: string): Promise<CachedTrailImages | null> {
    return withDb<CachedTrailImages | null>(null, async (db) => {
      const stored = await getFromStore<StoredEntry>(db, keyFor(trailId));
      if (!stored) return null;
      if (stored.ownerUid !== ownerUid) {
        await deleteAll(db, [keyFor(trailId)]);
        return null;
      }
      return { revision: stored.revision, images: stored.images };
    });
  },

  put(ownerUid: string, trailId: string, revision: string, images: TrailImage[]): Promise<void> {
    const entry: StoredEntry = { ownerUid, revision, images };
    return withDb<void>(undefined, (db) => putAll(db, [[keyFor(trailId), entry]]));
  },

  remove(trailId: string): Promise<void> {
    return withDb<void>(undefined, (db) => deleteAll(db, [keyFor(trailId)]));
  },

  clear(): Promise<void> {
    return withDb<void>(undefined, async (db) => deleteAll(db, await keysWithPrefix(db, KEY_PREFIX)));
  },
};

const serialize = createSerialQueue();

export const trailImageStore = {
  get: (ownerUid: string, trailId: string) => serialize(() => unqueuedStore.get(ownerUid, trailId)),
  put: (...args: Parameters<typeof unqueuedStore.put>) => serialize(() => unqueuedStore.put(...args)),
  remove: (trailId: string) => serialize(() => unqueuedStore.remove(trailId)),
  clear: () => serialize(() => unqueuedStore.clear()),
};
