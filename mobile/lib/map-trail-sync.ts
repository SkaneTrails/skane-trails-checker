import { trailsApi } from '@/lib/api';
import { mergeTrails } from '@/lib/storage/merge-trails';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import type { Trail } from '@/lib/types';

/**
 * Local-first load of every trail with its map coordinates.
 *
 * Reads the local copy first and hands it to `onLocal` so the map can draw before any
 * network request finishes. Then asks the server only for what changed since the last
 * sync, applies that to the local copy and returns the result. The first sync, with no
 * local copy, fetches everything once.
 *
 * With a local copy, a failed request is not an error: the local trails are returned.
 */
export async function syncMapTrails(onLocal: (trails: Trail[]) => void): Promise<Trail[]> {
  const local = await mapTrailStore.get();
  if (local.trails.length > 0) onLocal(local.trails);

  let changes: Awaited<ReturnType<typeof trailsApi.getTrailChanges>>;
  try {
    changes = await trailsApi.getTrailChanges(local.lastSyncTime ?? undefined);
  } catch (error) {
    if (local.trails.length === 0) throw error;
    console.warn('Trail sync failed, using the local copy', error);
    return local.trails;
  }

  const hasChanges = changes.trails.length > 0 || changes.deleted_ids.length > 0;
  if (!hasChanges && local.lastSyncTime !== null) return local.trails;

  await mapTrailStore.apply(changes.trails, changes.deleted_ids, changes.server_time);
  return mergeTrails(local.trails, changes.trails, changes.deleted_ids);
}
