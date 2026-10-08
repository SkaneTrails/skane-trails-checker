import { trailsApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { mergeTrails } from '@/lib/storage/merge-trails';
import { createSerialQueue } from '@/lib/storage/serial-queue';
import type { Trail, TrailChanges } from '@/lib/types';

// One sync at a time: each reads the stored cursor first, so overlapping ones (the query on mount
// and the status poll) could otherwise finish out of order and let an older result replace a newer.
const serialize = createSerialQueue();

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
 * With `strict`, it is: the failure is thrown, so a caller that must know the sync happened
 * (the sync status poll) does not mistake the old local copy for a fresh one.
 *
 * Calls run one after another, in the order they were made.
 */
export function syncMapTrails(
  onLocal: (trails: Trail[]) => void,
  options: { strict?: boolean } = {},
): Promise<Trail[]> {
  return serialize(() => runSync(onLocal, options));
}

async function runSync(
  onLocal: (trails: Trail[]) => void,
  options: { strict?: boolean },
): Promise<Trail[]> {
  const ownerUid = currentUserId();
  let local = await mapTrailStore.get(ownerUid);
  if (local.trails.length > 0) onLocal(local.trails);

  let changes: TrailChanges;
  try {
    changes = await trailsApi.getTrailChanges(local.lastSyncTime ?? undefined);
  } catch (error) {
    if (local.trails.length === 0 || options.strict) throw error;
    console.warn('Trail sync failed, using the local copy', error);
    return local.trails;
  }

  if (local.scope !== null && local.scope !== changes.scope) {
    // Stop showing the old scope's trails now, even if the refetch below fails.
    onLocal([]);
    await mapTrailStore.clear();
    local = { trails: [], lastSyncTime: null, scope: null };
    changes = await trailsApi.getTrailChanges();
  }

  const hasChanges = changes.trails.length > 0 || changes.deleted_ids.length > 0;
  if (!hasChanges && local.lastSyncTime !== null) return local.trails;

  await mapTrailStore.apply(
    ownerUid,
    changes.trails,
    changes.deleted_ids,
    { lastSyncTime: changes.server_time, scope: changes.scope },
    // Without a cursor the response is a full snapshot (also after an unreadable local copy), so it
    // replaces what is stored: a trail deleted on the server has no tombstone to remove it.
    { replace: local.lastSyncTime === null },
  );
  return mergeTrails(local.trails, changes.trails, changes.deleted_ids);
}
