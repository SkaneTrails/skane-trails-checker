/**
 * AsyncStorage persistence layer for trail data (native).
 *
 * Caches trail list data across app restarts to avoid full API
 * reads on every cold start. Uses two AsyncStorage keys:
 * - "@trails": the cached Trail[] array (JSON)
 * - "@lastSyncTime": ISO timestamp of last successful sync
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trail } from '@/lib/types';

export interface CachedTrailData {
  trails: Trail[];
  lastSyncTime: string | null;
}

const TRAILS_KEY = '@trails';
const SYNC_TIME_KEY = '@lastSyncTime';

export const trailCache = {
  async get(): Promise<CachedTrailData> {
    try {
      const [trailsJson, lastSyncTime] = await AsyncStorage.multiGet([TRAILS_KEY, SYNC_TIME_KEY]);
      const trails: Trail[] = trailsJson[1] ? JSON.parse(trailsJson[1]) : [];
      return {
        trails,
        lastSyncTime: lastSyncTime[1] ?? null,
      };
    } catch {
      return { trails: [], lastSyncTime: null };
    }
  },

  async set(trails: Trail[], lastSyncTime: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [TRAILS_KEY, JSON.stringify(trails)],
        [SYNC_TIME_KEY, lastSyncTime],
      ]);
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
      await AsyncStorage.multiRemove([TRAILS_KEY, SYNC_TIME_KEY]);
    } catch {
      // Clear failure is non-fatal
    }
  },
};
