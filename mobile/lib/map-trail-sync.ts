import { trailsApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { mergeTrails } from '@/lib/storage/merge-trails';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import type { Trail, TrailChanges } from '@/lib/types';

/**
 * Local-first load of every trail with its map coordinates.
 *
 * Reads the signed-in user's local copy first and hands it to `onLocal` so the map can draw
 * before any network request finishes. Then asks the server only for what changed since the
 * last sync, applies that to the local copy and returns the result. The first sync, with no
 * local copy, fetches everything once. If the server reports a different scope than the one
 * the copy was synced under (the user moved to another group, or became a superuser), the
 * copy and its cursor no longer apply, so it is dropped and everything is fetched again.
 *
 * With a usable local copy, a failed request is not an error: the local trails are returned.
 */
export async function syncMapTrails(onLocal: (trails: Trail[]) => void): Promise<Trail[]> {
  const ownerUid = currentUserId();
  let local = await mapTrailStore.get(ownerUid);
  if (local.trails.length > 0) onLocal(local.trails);

  let changes: TrailChanges;
  try {
    changes = await trailsApi.getTrailChanges(local.lastSyncTime ?? undefined);
  } catch (error) {
    if (local.trails.length === 0) throw error;
    console.warn('Trail sync failed, using the local copy', error);
    return local.trails;
  }

  if (local.scope !== null && local.scope !== changes.scope) {
    await mapTrailStore.clear();
    local = { trails: [], lastSyncTime: null, scope: null };
    changes = await trailsApi.getTrailChanges();
  }

  const hasChanges = changes.trails.length > 0 || changes.deleted_ids.length > 0;
  if (!hasChanges && local.lastSyncTime !== null) return local.trails;

  await mapTrailStore.apply(ownerUid, changes.trails, changes.deleted_ids, {
    lastSyncTime: changes.server_time,
    scope: changes.scope,
  });
  return mergeTrails(local.trails, changes.trails, changes.deleted_ids);
}
