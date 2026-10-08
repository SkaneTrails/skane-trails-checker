/**
 * Local copy of every trail with its map coordinates (web, IndexedDB).
 *
 * Kept apart from the summary cache in trail-cache so the heavy coordinates are
 * stored once and only changed trails travel from the server after the first sync.
 */
import type { Trail } from '@/lib/types';
import { getFromStore, openDb, putInStore } from './trail-cache.web';
import { mergeTrails } from './merge-trails';

export interface CachedMapTrails {
  trails: Trail[];
  lastSyncTime: string | null;
}

const TRAILS_KEY = 'mapTrails';
const SYNC_TIME_KEY = 'mapLastSyncTime';

export const mapTrailStore = {
  async get(): Promise<CachedMapTrails> {
    let db: IDBDatabase | undefined;
    try {
      db = await openDb();
      const [trails, lastSyncTime] = await Promise.all([
        getFromStore<Trail[]>(db, TRAILS_KEY),
        getFromStore<string>(db, SYNC_TIME_KEY),
      ]);
      return { trails: trails ?? [], lastSyncTime: lastSyncTime || null };
    } catch {
      return { trails: [], lastSyncTime: null };
    } finally {
      db?.close();
    }
  },

  /** Store changed trails and drop deleted ones. Keeps the old sync time when none is given. */
  async apply(changed: Trail[], deletedIds: string[], lastSyncTime?: string): Promise<void> {
    let db: IDBDatabase | undefined;
    try {
      db = await openDb();
      const [existing, previousSyncTime] = await Promise.all([
        getFromStore<Trail[]>(db, TRAILS_KEY),
        getFromStore<string>(db, SYNC_TIME_KEY),
      ]);
      await putInStore(db, TRAILS_KEY, mergeTrails(existing ?? [], changed, deletedIds));
      const syncTime = lastSyncTime ?? previousSyncTime;
      if (syncTime) await putInStore(db, SYNC_TIME_KEY, syncTime);
    } catch {
      // A failed write only costs a fuller sync on the next start.
    } finally {
      db?.close();
    }
  },

  async clear(): Promise<void> {
    let db: IDBDatabase | undefined;
    try {
      db = await openDb();
      await putInStore(db, TRAILS_KEY, []);
      await putInStore(db, SYNC_TIME_KEY, '');
    } catch {
      // Nothing to clear.
    } finally {
      db?.close();
    }
  },
};
