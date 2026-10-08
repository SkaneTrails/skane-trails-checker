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
const REFRESH_BY_KIND: Record<SyncKind, (queryClient: QueryClient) => Promise<void>> = {
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
 */
async function refreshTrails(queryClient: QueryClient): Promise<void> {
  const trails = await syncMapTrails(() => undefined, { strict: true });
  queryClient.setQueryData(trailKeys.map(), trails);
  await queryClient.invalidateQueries({ queryKey: trailKeys.detailQueries(), refetchType: 'active' });
}

let inFlight: Promise<void> | null = null;

/**
 * Ask the server what changed and refetch only that. One small request when nothing did.
 *
 * Versions are only compared for equality, and a version is remembered only after its
 * refetch succeeded, so a failed refetch is retried at the next poll. Concurrent calls
 * share one poll. Never throws: the app keeps working from its local copy offline.
 */
export function pollSyncStatus(queryClient: QueryClient): Promise<void> {
  inFlight ??= runPoll(queryClient).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runPoll(queryClient: QueryClient): Promise<void> {
  try {
    const ownerUid = currentUserId();
    let state = await syncSeen.get();

    // Someone else signed in on this device: nothing local is theirs to keep, whether or not the
    // server can be reached now.
    if (state.ownerUid !== null && state.ownerUid !== ownerUid) {
      await forceReload(queryClient);
      state = { ownerUid, scope: null, seen: {} };
      await syncSeen.set(state);
    }

    const status = await syncApi.getStatus();
    let dirty = state.ownerUid !== ownerUid || state.scope !== status.scope;

    // Same user, different access (moved group, role changed): no data version reflects that.
    if (state.scope !== null && state.scope !== status.scope) {
      await forceReload(queryClient);
      state = { ownerUid, scope: status.scope, seen: {} };
    }

    const firstPoll = state.ownerUid === null;
    const changed = firstPoll
      ? SYNC_KINDS
      : SYNC_KINDS.filter((kind) => status[kind] !== (state.seen[kind] ?? null));
    const refreshed: Partial<SyncStatus> = {};
    await Promise.all(
      changed.map(async (kind) => {
        try {
          await REFRESH_BY_KIND[kind](queryClient);
          refreshed[kind] = status[kind];
        } catch (error) {
          console.warn(`Refreshing ${kind} failed, will retry`, error);
        }
      }),
    );
    dirty ||= Object.keys(refreshed).length > 0;
    if (dirty) {
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
