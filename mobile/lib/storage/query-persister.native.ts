/**
 * AsyncStorage-backed persister for React Query cache (native).
 *
 * Serializes the dehydrated query cache into a single AsyncStorage
 * entry, surviving app restarts. Mirrors the web IDB persister
 * contract for platform parity.
 */
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@tanstack-query-cache';

/** Maximum age of persisted cache before it's discarded (24 hours). */
const MAX_AGE = 1000 * 60 * 60 * 24;

export function createPersister(): Persister {
  return {
    async persistClient(client: PersistedClient) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(client));
      } catch {
        // Persistence failure is non-fatal
      }
    },

    async restoreClient(): Promise<PersistedClient | undefined> {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return undefined;

        const client: PersistedClient = JSON.parse(raw);

        if (Date.now() - client.timestamp > MAX_AGE) {
          await AsyncStorage.removeItem(CACHE_KEY);
          return undefined;
        }

        return client;
      } catch {
        return undefined;
      }
    },

    async removeClient() {
      try {
        await AsyncStorage.removeItem(CACHE_KEY);
      } catch {
        // Removal failure is non-fatal
      }
    },
  };
}
