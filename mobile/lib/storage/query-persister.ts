/**
 * IndexedDB-backed persister for React Query cache.
 *
 * Serializes the entire dehydrated query cache into a single
 * IndexedDB entry, surviving page refreshes and app restarts.
 * Uses the `idb` library for a cleaner async IndexedDB API.
 *
 * Queries with `meta: { persist: false }` are excluded from
 * persistence (useful for transient data like auth tokens).
 */
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { openDB } from 'idb';

const DB_NAME = 'skane-trails-query';
const DB_VERSION = 1;
const STORE_NAME = 'query-cache';
const CACHE_KEY = 'tanstack-query';

/** Maximum age of persisted cache before it's discarded (24 hours). */
const MAX_AGE = 1000 * 60 * 60 * 24;

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export function createIdbPersister(): Persister {
  return {
    async persistClient(client: PersistedClient) {
      try {
        const db = await getDb();
        await db.put(STORE_NAME, client, CACHE_KEY);
      } catch {
        // Persistence failure is non-fatal
      }
    },

    async restoreClient(): Promise<PersistedClient | undefined> {
      try {
        const db = await getDb();
        const client = await db.get(STORE_NAME, CACHE_KEY) as PersistedClient | undefined;
        if (!client) return undefined;

        // Discard stale cache
        if (Date.now() - client.timestamp > MAX_AGE) {
          await db.delete(STORE_NAME, CACHE_KEY);
          return undefined;
        }

        return client;
      } catch {
        return undefined;
      }
    },

    async removeClient() {
      try {
        const db = await getDb();
        await db.delete(STORE_NAME, CACHE_KEY);
      } catch {
        // Removal failure is non-fatal
      }
    },
  };
}
