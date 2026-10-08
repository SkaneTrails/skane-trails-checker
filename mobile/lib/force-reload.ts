import type { QueryClient } from '@tanstack/react-query';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { trailCache } from '@/lib/storage/trail-cache';

/**
 * Throw away everything stored on this device and download it again.
 *
 * An escape hatch for when the local copy is wrong. The mounted screens refetch as soon
 * as their queries are reset, so this resolves once the new data has arrived.
 */
export async function forceReload(queryClient: QueryClient): Promise<void> {
  await Promise.all([mapTrailStore.clear(), trailCache.clear()]);
  await queryClient.resetQueries();
}
