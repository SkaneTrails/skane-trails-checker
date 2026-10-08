/**
 * Local copy of every trail with its map coordinates (web, IndexedDB).
 *
 * Kept apart from the summary cache in trail-cache so the heavy coordinates are
 * stored once and only changed trails travel from the server after the first sync.
 *
 * The copy belongs to one signed-in user and one visibility scope (their group, or
 * everything for a superuser). Asking for it as another user empties it, so private
 * trails never carry over and a cursor from one scope is never sent for another.
 * Every change to the stored keys is one IndexedDB transaction, so a failure part-way
 * can never leave the trails and the cursor disagreeing.
 */
import type { Trail } from '@/lib/types';
import { getFromStore, openDb, STORE_NAME } from './trail-cache.web';
import { mergeTrails } from './merge-trails';
import { createSerialQueue } from './serial-queue';

export interface CachedMapTrails {
  trails: Trail[];
  lastSyncTime: string | null;
  /** Scope the server reported at the last sync, or null before the first one. */
  scope: string | null;
}

/** Position the local copy has reached, taken from the server's response. */
export interface MapSyncState {
  lastSyncTime: string;
  scope: string;
}

const TRAILS_KEY = 'mapTrails';
const SYNC_TIME_KEY = 'mapLastSyncTime';
const OWNER_KEY = 'mapOwnerUid';
const SCOPE_KEY = 'mapScope';

const EMPTY: CachedMapTrails = { trails: [], lastSyncTime: null, scope: null };

/** Write several keys in one transaction: either all of them are stored or none. */
function putAll(db: IDBDatabase, entries: [string, unknown][]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [key, value] of entries) store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readAll(db: IDBDatabase) {
  const [trails, lastSyncTime, ownerUid, scope] = await Promise.all([
    getFromStore<Trail[]>(db, TRAILS_KEY),
    getFromStore<string>(db, SYNC_TIME_KEY),
    getFromStore<string>(db, OWNER_KEY),
    getFromStore<string>(db, SCOPE_KEY),
  ]);
  return {
    trails: trails ?? [],
    lastSyncTime: lastSyncTime || null,
    ownerUid: ownerUid || null,
    scope: scope || null,
  };
}

const clearEntries = (): [string, unknown][] => [
  [TRAILS_KEY, []],
  [SYNC_TIME_KEY, ''],
  [OWNER_KEY, ''],
  [SCOPE_KEY, ''],
];

const unqueuedStore = {
  /** Read the copy that belongs to `ownerUid`; another user's copy is erased and reads as empty. */
  async get(ownerUid: string): Promise<CachedMapTrails> {
    let db: IDBDatabase | undefined;
    try {
      db = await openDb();
      const stored = await readAll(db);
      if (stored.ownerUid !== ownerUid) {
        if (stored.ownerUid !== null || stored.trails.length > 0) await putAll(db, clearEntries());
        return EMPTY;
      }
      return { trails: stored.trails, lastSyncTime: stored.lastSyncTime, scope: stored.scope };
    } catch {
      return EMPTY;
    } finally {
      db?.close();
    }
  },

  /**
   * Store changed trails and drop deleted ones for `ownerUid`, replacing another user's copy.
   * Keeps the previous sync position when none is given. With `replace`, `changed` is a full
   * snapshot: whatever was stored before (even after a failed read) is discarded, so a trail
   * deleted on the server cannot linger.
   */
  async apply(
    ownerUid: string,
    changed: Trail[],
    deletedIds: string[],
    sync?: MapSyncState,
    options: { replace?: boolean } = {},
  ): Promise<void> {
    let db: IDBDatabase | undefined;
    try {
      db = await openDb();
      const stored = await readAll(db);
      const keep = stored.ownerUid === ownerUid && !options.replace;
      const base = keep ? stored : { ...stored, trails: [], lastSyncTime: null, scope: null };
      await putAll(db, [
        [TRAILS_KEY, mergeTrails(base.trails, changed, deletedIds)],
        [SYNC_TIME_KEY, sync?.lastSyncTime ?? base.lastSyncTime ?? ''],
        [SCOPE_KEY, sync?.scope ?? base.scope ?? ''],
        [OWNER_KEY, ownerUid],
      ]);
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
      await putAll(db, clearEntries());
    } catch {
      // Nothing to clear.
    } finally {
      db?.close();
    }
  },
};

const serialize = createSerialQueue();

/**
 * The store's operations run one at a time: apply reads the stored trails, merges and writes them
 * back, so overlapping calls (the mutation hooks do not wait) would overwrite each other.
 */
export const mapTrailStore = {
  get: (ownerUid: string) => serialize(() => unqueuedStore.get(ownerUid)),
  apply: (...args: Parameters<typeof unqueuedStore.apply>) =>
    serialize(() => unqueuedStore.apply(...args)),
  clear: () => serialize(() => unqueuedStore.clear()),
};
