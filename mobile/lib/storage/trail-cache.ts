/**
 * IndexedDB persistence layer for trail data.
 *
 * Caches trail list data across sessions to avoid full Firestore
 * reads on every app open. Uses a simple key-value store with two entries:
 * - "trails": the cached Trail[] array
 * - "lastSyncTime": ISO timestamp of last successful sync
 */
import type { Trail } from '@/lib/types';

const DB_NAME = 'skane-trails';
const DB_VERSION = 1;
const STORE_NAME = 'trail-cache';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFromStore<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function putInStore<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export interface CachedTrailData {
  trails: Trail[];
  lastSyncTime: string | null;
}

export const trailCache = {
  async get(): Promise<CachedTrailData> {
    try {
      const db = await openDb();
      const [trails, lastSyncTime] = await Promise.all([
        getFromStore<Trail[]>(db, 'trails'),
        getFromStore<string>(db, 'lastSyncTime'),
      ]);
      db.close();
      return {
        trails: trails ?? [],
        lastSyncTime: lastSyncTime ?? null,
      };
    } catch {
      return { trails: [], lastSyncTime: null };
    }
  },

  async set(trails: Trail[], lastSyncTime: string): Promise<void> {
    try {
      const db = await openDb();
      await Promise.all([
        putInStore(db, 'trails', trails),
        putInStore(db, 'lastSyncTime', lastSyncTime),
      ]);
      db.close();
    } catch {
      // Cache write failure is non-fatal — next open will do a full fetch
    }
  },

  async merge(newTrails: Trail[], lastSyncTime: string): Promise<Trail[]> {
    const { trails: cached } = await this.get();
    const trailMap = new Map(cached.map((t) => [t.trail_id, t]));
    for (const trail of newTrails) {
      trailMap.set(trail.trail_id, trail);
    }
    const merged = Array.from(trailMap.values());
    await this.set(merged, lastSyncTime);
    return merged;
  },

  async clear(): Promise<void> {
    try {
      const db = await openDb();
      await clearStore(db);
      db.close();
    } catch {
      // Clear failure is non-fatal
    }
  },
};
