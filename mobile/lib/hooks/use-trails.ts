import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { TrailFilters } from '@/lib/api';
import { trailsApi } from '@/lib/api';
import { trailCache } from '@/lib/storage/trail-cache';
import type { Trail, TrailUpdate } from '@/lib/types';

export const trailKeys = {
  all: ['trails'] as const,
  list: (filters: TrailFilters) => ['trails', 'list', filters] as const,
  detail: (id: string) => ['trails', 'detail', id] as const,
  details: (id: string) => ['trails', 'details', id] as const,
  sync: ['trails', 'sync'] as const,
};

/**
 * Sync-on-mount trail hook.
 *
 * 1. Load cached trails from IndexedDB → seed React Query immediately
 * 2. Background-check sync metadata endpoint (1 Firestore read)
 * 3. If server count < local count → full refetch (deletion case)
 * 4. If server has newer data → delta fetch (since=lastSyncTime)
 * 5. Merge new trails into cache + React Query
 *
 * useQuery is disabled until sync completes (or fails) so the default
 * full-fetch only runs when there's no cached data to work from.
 */
export function useTrails(filters: TrailFilters = {}) {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);
  const [syncDone, setSyncDone] = useState(false);
  const queryKey = trailKeys.list(filters);

  const isUnfilteredQuery =
    !filters.source &&
    !filters.search &&
    !filters.min_distance_km &&
    !filters.max_distance_km &&
    !filters.status;

  const query = useQuery({
    queryKey,
    queryFn: () => trailsApi.getTrails(filters),
    // For unfiltered queries, disable the automatic fetch until sync decides
    // whether a full fetch is actually needed (saves Firestore reads).
    // Filtered queries always fetch directly (no cache for those).
    enabled: !isUnfilteredQuery || syncDone,
  });

  // Sync-on-mount: seed cache, then background delta sync
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    // Only sync for the unfiltered query to avoid double-syncing
    if (!isUnfilteredQuery) return;

    syncTrails(queryClient, queryKey).finally(() => setSyncDone(true));
  }, [queryClient, queryKey, isUnfilteredQuery]);

  return query;
}

async function syncTrails(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
): Promise<void> {
  try {
    const cached = await trailCache.get();

    // If we have cached data, seed React Query immediately
    if (cached.trails.length > 0) {
      queryClient.setQueryData(queryKey, cached.trails);
    }

    // Check sync metadata (1 Firestore read)
    const syncMeta = await trailsApi.getSyncMetadata();

    // Deletion detected: server has fewer trails → full refetch
    if (syncMeta.count < cached.trails.length) {
      const allTrails = await trailsApi.getTrails({});
      const now = new Date().toISOString();
      await trailCache.set(allTrails, now);
      queryClient.setQueryData(queryKey, allTrails);
      return;
    }

    // No changes since last sync
    if (syncMeta.last_modified === cached.lastSyncTime && syncMeta.count === cached.trails.length) {
      return;
    }

    // Delta fetch: get only new trails since last sync
    if (cached.lastSyncTime && cached.trails.length > 0) {
      const newTrails = await trailsApi.getTrails({ since: cached.lastSyncTime });
      if (newTrails.length > 0) {
        const merged = await trailCache.merge(
          newTrails,
          syncMeta.last_modified ?? new Date().toISOString(),
        );
        queryClient.setQueryData(queryKey, merged);
      } else {
        // Metadata changed but no new trails by created_at filter:
        // fall back to a full refetch to capture edits to existing trails.
        const allTrails = await trailsApi.getTrails({});
        const now = syncMeta.last_modified ?? new Date().toISOString();
        await trailCache.set(allTrails, now);
        queryClient.setQueryData(queryKey, allTrails);
      }
      return;
    }

    // First load — no cache: let useQuery do the full fetch
    // (enabled becomes true when syncDone is set)
  } catch {
    // Sync failure is non-fatal — useQuery still fetches from API
  }
}

export function useTrail(id: string) {
  return useQuery({
    queryKey: trailKeys.detail(id),
    queryFn: () => trailsApi.getTrail(id),
    enabled: !!id,
  });
}

export function useTrailDetails(id: string) {
  return useQuery({
    queryKey: trailKeys.details(id),
    queryFn: () => trailsApi.getTrailDetails(id),
    enabled: !!id,
  });
}

export function useUpdateTrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TrailUpdate }) =>
      trailsApi.updateTrail(id, data),
    onSuccess: (updatedTrail, { id }) => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
      // Update persistent cache with the full server response so
      // server-computed fields (last_updated, modified_at) stay current.
      trailCache.get().then(({ trails, lastSyncTime }) => {
        const updated = trails.map((t) => (t.trail_id === id ? (updatedTrail as Trail) : t));
        trailCache.set(updated, lastSyncTime ?? new Date().toISOString());
      });
    },
  });
}

export function useDeleteTrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => trailsApi.deleteTrail(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
      // Remove from local cache immediately
      trailCache.get().then(({ trails, lastSyncTime }) => {
        const filtered = trails.filter((t) => t.trail_id !== deletedId);
        trailCache.set(filtered, lastSyncTime ?? new Date().toISOString());
      });
    },
  });
}

export function useUploadGpx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, source }: { file: File; source?: string }) =>
      trailsApi.uploadGpx(file, source),
    onSuccess: (newTrails) => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
      // Merge new trails into cache in a single read-then-write to avoid
      // the double-read that trailCache.merge() would introduce. Preserves
      // the server-issued lastSyncTime so the next delta sync uses the
      // correct baseline (client Date() would mismatch last_modified).
      if (newTrails.length > 0) {
        trailCache.get().then(({ trails, lastSyncTime }) => {
          const merged = new Map(trails.map((t) => [t.trail_id, t]));
          for (const trail of newTrails) {
            merged.set(trail.trail_id, trail);
          }
          trailCache.set(
            Array.from(merged.values()),
            lastSyncTime ?? new Date().toISOString(),
          );
        });
      }
    },
  });
}
