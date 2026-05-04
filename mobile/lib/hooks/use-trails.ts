import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trailsApi } from '@/lib/api';
import { trailCache } from '@/lib/storage/trail-cache';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { Trail, TrailUpdate } from '@/lib/types';

export const SYNC_POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes

export interface ClientTrailFilters {
  search?: string;
  status?: Trail['status'];
  min_distance_km?: number;
  max_distance_km?: number;
}

/**
 * Sort trails so uploaded trails appear before planned ones.
 * Within each group, sort alphabetically by name.
 */
export function sortTrails(trails: Trail[]): Trail[] {
  return [...trails].sort((a, b) => {
    const aPlanned = a.source === 'planned_hikes' ? 1 : 0;
    const bPlanned = b.source === 'planned_hikes' ? 1 : 0;
    if (aPlanned !== bPlanned) return aPlanned - bPlanned;
    const aName = a.name.toLocaleLowerCase('en-US');
    const bName = b.name.toLocaleLowerCase('en-US');
    return aName.localeCompare(bName, 'en-US');
  });
}

export const trailKeys = {
  all: ['trails'] as const,
  list: () => ['trails', 'list'] as const,
  map: () => ['trails', 'map'] as const,
  detail: (id: string) => ['trails', 'detail', id] as const,
  details: (id: string) => ['trails', 'details', id] as const,
  sync: ['trails', 'sync'] as const,
};

/**
 * Sync-on-mount trail hook.
 *
 * Always fetches the full unfiltered trail list via sync mechanism.
 * For client-side filtering, use the returned data with filterTrails().
 */
export function useTrails() {
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);
  const [syncDone, setSyncDone] = useState(false);
  const queryKey = trailKeys.list();

  const query = useQuery({
    queryKey,
    queryFn: () => trailsApi.getTrailSummaries({}),
    select: sortTrails,
    enabled: syncDone,
  });

  // Sync-on-mount: seed cache, then background delta sync
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    syncTrails(queryClient, queryKey).finally(() => setSyncDone(true));
  }, [queryClient, queryKey]);

  // Poll sync metadata every 5 minutes to detect changes from other devices.
  // Uses self-scheduling setTimeout to prevent overlapping polls when a
  // request takes longer than the interval (slow network / hung request).
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePoll = useCallback(() => {
    pollRef.current = setTimeout(async () => {
      await pollForChanges(queryClient, queryKey);
      schedulePoll();
    }, SYNC_POLL_INTERVAL);
  }, [queryClient, queryKey]);

  useEffect(() => {
    if (!syncDone) return;

    schedulePoll();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [syncDone, schedulePoll]);

  return query;
}

/**
 * Apply search, status, and distance filters client-side.
 * Returns a filtered subset of the provided trails.
 */
export function filterTrails(trails: Trail[], filters: ClientTrailFilters): Trail[] {
  let result = trails;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(q));
  }

  if (filters.status) {
    result = result.filter((t) => t.status === filters.status);
  }

  if (filters.min_distance_km != null) {
    result = result.filter((t) => t.length_km >= filters.min_distance_km!);
  }

  if (filters.max_distance_km != null) {
    result = result.filter((t) => t.length_km <= filters.max_distance_km!);
  }

  return result;
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
      await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
      return;
    }

    // No changes since last sync
    if (syncMeta.last_modified === cached.lastSyncTime && syncMeta.count === cached.trails.length) {
      return;
    }

    // Delta fetch: get only new trails since last sync (summary = no coords).
    // Wrapped in its own try/catch so that validation errors (e.g.
    // millisecond timestamps rejected by the API) fall back to a
    // full refetch instead of aborting the entire sync.
    if (cached.lastSyncTime && cached.trails.length > 0) {
      try {
        const newTrails = await trailsApi.getTrailSummaries({ since: cached.lastSyncTime });
        if (newTrails.length > 0) {
          const merged = await trailCache.merge(
            newTrails,
            syncMeta.last_modified ?? new Date().toISOString(),
          );
          queryClient.setQueryData(queryKey, merged);
        } else {
          // Metadata changed but no new trails by created_at filter:
          // fall back to a full refetch to capture edits to existing trails.
          await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
        }
      } catch (error) {
        // Delta fetch failed (e.g. invalid timestamp format) — recover
        // via full refetch so the user still sees all trails.
        console.warn('Trail delta fetch failed, falling back to full refetch', error);
        await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
      }
      return;
    }

    // First load — no cache: fetch summaries (no coords) for fast initial load.
    const allTrails = await trailsApi.getTrailSummaries({});
    const syncTime = syncMeta.last_modified ?? new Date().toISOString();
    await trailCache.set(allTrails, syncTime);
    queryClient.setQueryData(queryKey, allTrails);
  } catch (error) {
    console.warn('Trail sync failed:', error);
    // Sync failure is non-fatal — useQuery still fetches from API
  }
}

async function fullRefetch(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  lastModified: string | null | undefined,
): Promise<void> {
  const allTrails = await trailsApi.getTrailSummaries({});
  const syncTime = lastModified ?? new Date().toISOString();
  await trailCache.set(allTrails, syncTime);
  queryClient.setQueryData(queryKey, allTrails);
}

/**
 * Poll sync metadata once, and if the server's last_modified differs
 * from the local cache, trigger a delta or full refetch.
 */
export async function pollForChanges(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
): Promise<void> {
  try {
    const syncMeta = await trailsApi.getSyncMetadata();
    const cached = await trailCache.get();

    // No changes
    if (
      syncMeta.last_modified === cached.lastSyncTime &&
      syncMeta.count === cached.trails.length
    ) {
      return;
    }

    // Deletion detected
    if (syncMeta.count < cached.trails.length) {
      await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
      return;
    }

    // Delta fetch
    if (cached.lastSyncTime && cached.trails.length > 0) {
      try {
        const newTrails = await trailsApi.getTrailSummaries({ since: cached.lastSyncTime });
        if (newTrails.length > 0) {
          const merged = await trailCache.merge(
            newTrails,
            syncMeta.last_modified ?? new Date().toISOString(),
          );
          queryClient.setQueryData(queryKey, merged);
        } else {
          await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
        }
      } catch {
        await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
      }
      return;
    }

    // No cache — full fetch
    await fullRefetch(queryClient, queryKey, syncMeta.last_modified);
  } catch (error) {
    console.warn('Background sync poll failed:', error);
  }
}

export function useTrail(id: string) {
  return useQuery({
    queryKey: trailKeys.detail(id),
    queryFn: () => trailsApi.getTrail(id),
    enabled: !!id,
  });
}

/**
 * Fetch full trail data (including coordinates_map) for map rendering.
 *
 * Uses long stale time since trail routes rarely change.
 * Shows summary data from the list cache as placeholder while loading.
 */
export function useMapTrails(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: trailKeys.map(),
    queryFn: () => trailsApi.getTrails({}),
    staleTime: 30 * 60 * 1000, // 30 min — trail routes rarely change
    placeholderData: () => queryClient.getQueryData<Trail[]>(trailKeys.list()),
    enabled: options?.enabled,
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
      // Update React Query cache directly — no refetch needed since we
      // have the full server response with computed fields.
      queryClient.setQueryData<Trail[]>(trailKeys.list(), (old) =>
        old?.map((t) => (t.trail_id === id ? (updatedTrail as Trail) : t)),
      );
      queryClient.setQueryData(trailKeys.detail(id), updatedTrail);
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) =>
        old?.map((t) => (t.trail_id === id ? (updatedTrail as Trail) : t)),
      );
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
      // Update React Query cache directly — no refetch needed.
      queryClient.setQueryData<Trail[]>(trailKeys.list(), (old) =>
        old?.filter((t) => t.trail_id !== deletedId),
      );
      queryClient.removeQueries({ queryKey: trailKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: trailKeys.details(deletedId) });
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) =>
        old?.filter((t) => t.trail_id !== deletedId),
      );
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
    mutationFn: ({ file, ...options }: { file: File } & Parameters<typeof trailsApi.uploadGpx>[1]) =>
      trailsApi.uploadGpx(file, options),
    onSuccess: (newTrails) => {
      // Merge new trails into React Query cache directly — no refetch.
      if (newTrails.length > 0) {
        queryClient.setQueryData<Trail[]>(trailKeys.list(), (old) => {
          const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
          for (const trail of newTrails) {
            merged.set(trail.trail_id, trail);
          }
          return Array.from(merged.values());
        });
        queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) => {
          const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
          for (const trail of newTrails) {
            merged.set(trail.trail_id, trail);
          }
          return Array.from(merged.values());
        });
        trailCache.get().then(({ trails, lastSyncTime }) => {
          const merged = new Map(trails.map((t) => [t.trail_id, t]));
          for (const trail of newTrails) {
            merged.set(trail.trail_id, trail);
          }
          trailCache.set(Array.from(merged.values()), lastSyncTime ?? new Date().toISOString());
        });
      }
    },
  });
}

export function useSaveRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, points }: { name: string; points: TrackingPoint[] }) =>
      trailsApi.saveRecording(name, points),
    onSuccess: (savedTrail) => {
      // Add saved trail to React Query cache directly — no refetch.
      queryClient.setQueryData<Trail[]>(trailKeys.list(), (old) => {
        const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
        merged.set(savedTrail.trail_id, savedTrail);
        return Array.from(merged.values());
      });
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) => {
        const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
        merged.set(savedTrail.trail_id, savedTrail);
        return Array.from(merged.values());
      });
      trailCache.get().then(({ trails, lastSyncTime }) => {
        const merged = new Map(trails.map((t) => [t.trail_id, t]));
        merged.set(savedTrail.trail_id, savedTrail);
        trailCache.set(Array.from(merged.values()), lastSyncTime ?? new Date().toISOString());
      });
    },
  });
}
