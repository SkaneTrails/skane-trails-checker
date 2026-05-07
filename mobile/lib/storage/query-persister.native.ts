/**
 * AsyncStorage-backed persister for React Query cache (native).
 *
 * Serializes the dehydrated query cache into a single AsyncStorage
 * entry, surviving app restarts. Mirrors the web IDB persister
 * contract for platform parity.
 */
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSIST_MAX_AGE } from './persist-constants';

const CACHE_KEY = '@skane_trails_query_cache';

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

        if (typeof client.timestamp !== 'number' || !Number.isFinite(client.timestamp)) {
          await AsyncStorage.removeItem(CACHE_KEY);
          return undefined;
        }

        if (Date.now() - client.timestamp > PERSIST_MAX_AGE) {
          await AsyncStorage.removeItem(CACHE_KEY);
          return undefined;
        }

        return client;
      } catch {
        await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
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
