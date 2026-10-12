import { trailsApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { trailImageStore } from '@/lib/storage/trail-image-store';
import type { TrailImagesResponse } from '@/lib/types';

/**
 * A trail's photos: from this device while its copy matches the trail's current revision,
 * otherwise from the server (and the new copy is kept for next time).
 */
export async function loadTrailImages(
  trailId: string,
  revision: string | null,
): Promise<TrailImagesResponse> {
  const ownerUid = currentUserId();
  if (revision) {
    const stored = await trailImageStore.get(ownerUid, trailId);
    if (stored && stored.revision === revision) {
      return { trail_id: trailId, images: stored.images, revision };
    }
  }
  const fresh = await trailsApi.getTrailImages(trailId);
  if (fresh.revision) await trailImageStore.put(ownerUid, trailId, fresh.revision, fresh.images);
  return fresh;
}
