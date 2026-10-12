import type { QueryClient } from '@tanstack/react-query';
import { syncApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { forceReload } from '@/lib/force-reload';
import { foragingKeys } from '@/lib/hooks/use-foraging';
import { placeKeys } from '@/lib/hooks/use-places';
import { trailKeys } from '@/lib/hooks/use-trails';
import { syncMapTrails } from '@/lib/map-trail-sync';
import { type SeenState, syncSeen } from '@/lib/storage/sync-seen';
import type { SyncKind, SyncStatus } from '@/lib/types';

const SYNC_KINDS: SyncKind[] = ['trails', 'places', 'foraging_spots', 'foraging_types', 'images'];

const refetchActive = (queryKey: readonly unknown[]) => (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey, refetchType: 'active' }, { throwOnError: true });

/** How to bring each kind of data up to date; rejects if that failed, so the version is not remembered. */
const REFRESH_BY_KIND: Record<
  SyncKind,
  (queryClient: QueryClient, ownerUid: string) => Promise<void>
> = {
  trails: refreshTrails,
  places: refetchActive(placeKeys.all),
  foraging_spots: refetchActive(['foraging', 'spots']),
  foraging_types: refetchActive(foragingKeys.types),
  images: refetchActive(trailKeys.imagePins()),
};

/**
 * The trail sync is strict because it otherwise answers a failed request with the old local copy,
 * which would look like a success. Open trail screens are refetched too; one for a trail that was
 * deleted fails, which must not count against the version, so errors are not thrown for them.
 * The result is dropped if another user signed in meanwhile.
 */
async function refreshTrails(queryClient: QueryClient, ownerUid: string): Promise<void> {
  const trails = await syncMapTrails(() => undefined, { strict: true });
  if (currentUserId() !== ownerUid) return;
  queryClient.setQueryData(trailKeys.map(), trails);
  await queryClient.invalidateQueries({ queryKey: trailKeys.detailQueries(), refetchType: 'active' });
}

let inFlight: { ownerUid: string; promise: Promise<void> } | null = null;

/**
 * Make sure the local data belongs to the signed-in user, and return what was last synced for them.
 *
 * Data whose owner is someone else, or unknown (an older app version left it, or nothing was ever
 * synced), is not theirs to see: it is cleared whether or not the server can be reached, and the
 * user is saved as the owner with nothing seen. Needs no network.
 */
export async function claimLocalData(queryClient: QueryClient): Promise<SeenState> {
  const ownerUid = currentUserId();
  const state = await syncSeen.get();
  if (state.ownerUid === ownerUid) return state;

  await forceReload(queryClient);
  const fresh: SeenState = { ownerUid, scope: null, seen: {} };
  await syncSeen.set(fresh);
  return fresh;
}

/**
 * Ask the server what changed and refetch only that. One small request when nothing did.
 *
 * Versions are only compared for equality, and a version is remembered only after its
 * refetch succeeded, so a failed refetch is retried at the next poll. Concurrent calls by the
 * same user share one poll; a poll never outlives its user's session, since a result that
 * arrives after another user signed in is discarded. Never throws: the app keeps working from
 * its local copy offline.
 */
export function pollSyncStatus(queryClient: QueryClient): Promise<void> {
  const ownerUid = currentUserId();
  if (inFlight?.ownerUid === ownerUid) return inFlight.promise;

  const promise = runPoll(queryClient, ownerUid).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { ownerUid, promise };
  return promise;
}

async function runPoll(queryClient: QueryClient, ownerUid: string): Promise<void> {
  const signedOut = () => currentUserId() !== ownerUid;
  try {
    let state = await claimLocalData(queryClient);

    const status = await syncApi.getStatus();
    if (signedOut()) return;
    let dirty = state.ownerUid !== ownerUid || state.scope !== status.scope;

    // Same user, different access (moved group, role changed): no data version reflects that.
    if (state.scope !== null && state.scope !== status.scope) {
      await forceReload(queryClient);
      state = { ownerUid, scope: status.scope, seen: {} };
    }

    // A kind with no remembered version at all is refreshed once, even if the server has none yet,
    // so that every kind is backfilled and recorded before it is trusted.
    const changed = SYNC_KINDS.filter(
      (kind) => !(kind in state.seen) || status[kind] !== state.seen[kind],
    );
    const refreshed: Partial<SyncStatus> = {};
    await Promise.all(
      changed.map(async (kind) => {
        try {
          await REFRESH_BY_KIND[kind](queryClient, ownerUid);
          refreshed[kind] = status[kind];
        } catch (error) {
          console.warn(`Refreshing ${kind} failed, will retry`, error);
        }
      }),
    );
    dirty ||= Object.keys(refreshed).length > 0;
    if (dirty && !signedOut()) {
      const next: SeenState = {
        ownerUid,
        scope: status.scope,
        seen: { ...state.seen, ...refreshed },
      };
      await syncSeen.set(next);
    }
  } catch (error) {
    console.warn('Sync status poll failed:', error);
  }
}
