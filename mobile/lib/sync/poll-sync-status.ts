import type { QueryClient } from '@tanstack/react-query';
import { syncApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { forceReload } from '@/lib/force-reload';
import { foragingKeys } from '@/lib/hooks/use-foraging';
import { placeKeys } from '@/lib/hooks/use-places';
import { trailKeys } from '@/lib/hooks/use-trails';
import { syncSeen } from '@/lib/storage/sync-seen';
import type { SyncKind, SyncStatus } from '@/lib/types';

const SYNC_KINDS: SyncKind[] = ['trails', 'places', 'foraging_spots', 'foraging_types', 'images'];

/** The queries to refetch when each kind of data changed on the server. */
const QUERIES_BY_KIND: Record<SyncKind, readonly unknown[]> = {
  trails: trailKeys.map(),
  places: placeKeys.all,
  foraging_spots: ['foraging', 'spots'],
  foraging_types: foragingKeys.types,
  images: trailKeys.imagePins(),
};

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
    const status = await syncApi.getStatus();
    const ownerUid = currentUserId();
    const { ownerUid: seenOwner, seen } = await syncSeen.get();

    // Someone else signed in on this device: nothing local is theirs to keep.
    if (seenOwner !== null && seenOwner !== ownerUid) {
      await forceReload(queryClient);
      await syncSeen.set({ ownerUid, seen: status });
      return;
    }

    const changed =
      seenOwner === null ? SYNC_KINDS : SYNC_KINDS.filter((kind) => status[kind] !== (seen[kind] ?? null));
    const refreshed: Partial<SyncStatus> = {};
    await Promise.all(
      changed.map(async (kind) => {
        try {
          await queryClient.invalidateQueries(
            { queryKey: QUERIES_BY_KIND[kind], refetchType: 'active' },
            { throwOnError: true },
          );
          refreshed[kind] = status[kind];
        } catch (error) {
          console.warn(`Refreshing ${kind} failed, will retry`, error);
        }
      }),
    );
    if (seenOwner === null || changed.length > 0) {
      await syncSeen.set({ ownerUid, seen: { ...seen, ...refreshed } });
    }
  } catch (error) {
    console.warn('Sync status poll failed:', error);
  }
}
