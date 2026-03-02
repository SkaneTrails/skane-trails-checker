import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
 * 1. Load cached trails from IndexedDB → render immediately
 * 2. Background-check sync metadata endpoint (1 Firestore read)
 * 3. If server count < local count → full refetch (deletion case)
 * 4. If server has newer data → delta fetch (since=lastSyncTime)
 * 5. Merge new trails into cache + React Query
 */
export function useTrails(filters: TrailFilters = {}) {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);
  const queryKey = trailKeys.list(filters);

  const query = useQuery({
    queryKey,
    queryFn: () => trailsApi.getTrails(filters),
  });

  // Sync-on-mount: seed cache, then background delta sync
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    const isUnfilteredQuery =
      !filters.source && !filters.search && !filters.min_distance_km && !filters.max_distance_km && !filters.status;

    // Only sync for the unfiltered query to avoid double-syncing
    if (!isUnfilteredQuery) return;

    syncTrails(queryClient, queryKey);
  }, [queryClient, filters, queryKey]);

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
        const merged = await trailCache.merge(newTrails, syncMeta.last_modified ?? new Date().toISOString());
        queryClient.setQueryData(queryKey, merged);
      } else {
        // Update sync time even if no new trails (metadata changed)
        await trailCache.set(cached.trails, syncMeta.last_modified ?? cached.lastSyncTime);
      }
      return;
    }

    // First load — no cache: will populate from the useQuery result
    // Store whatever useQuery fetches
    const queryKeyHash = JSON.stringify(queryKey);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        JSON.stringify(event.query.queryKey) === queryKeyHash
      ) {
        const data = event.query.state.data as Trail[] | undefined;
        if (data && data.length > 0) {
          const now = syncMeta.last_modified ?? new Date().toISOString();
          trailCache.set(data, now);
          unsubscribe();
        }
      }
    });
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
    onSuccess: (_result, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
      // Update persistent cache so changes aren't lost on next app open
      trailCache.get().then(({ trails, lastSyncTime }) => {
        const updated = trails.map((t) =>
          t.trail_id === id ? { ...t, ...data } : t,
        );
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
      // Add new trails to cache immediately
      if (newTrails.length > 0) {
        const now = new Date().toISOString();
        trailCache.merge(newTrails, now);
      }
    },
  });
}
