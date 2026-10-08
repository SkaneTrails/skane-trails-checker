import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trailsApi } from '@/lib/api';
import type { ImageFile } from '@/lib/api/trails';
import { currentUserId } from '@/lib/auth-scope';
import { syncMapTrails } from '@/lib/map-trail-sync';
import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { trailImageStore } from '@/lib/storage/trail-image-store';
import type { TrackingPoint } from '@/lib/track-to-trail';
import { loadTrailImages } from '@/lib/trail-images';
import type { Trail, TrailImage, TrailImagesResponse, TrailUpdate } from '@/lib/types';

export interface ClientTrailFilters {
  search?: string;
  status?: Trail['status'];
  min_distance_km?: number;
  max_distance_km?: number;
}

export type TrailSortMode = 'date' | 'name';

/** Hike date for sorting; planned hikes have no hike date and count as undated. */
function trailTimestamp(trail: Trail): number {
  if (trail.source === 'planned_hikes') return Number.NEGATIVE_INFINITY;
  // activity_date is free text, so an unparseable one must not hide a valid created_at.
  for (const raw of [trail.activity_date, trail.created_at]) {
    const ms = raw ? Date.parse(raw) : Number.NaN;
    if (!Number.isNaN(ms)) return ms;
  }
  return Number.NEGATIVE_INFINITY;
}

/**
 * Sort trails so uploaded trails appear before planned ones.
 * Within each group: most recent first (undated last) or alphabetical by name.
 * Name is always the tie-breaker.
 */
export function sortTrails(
  trails: Trail[],
  mode: TrailSortMode = 'date',
  locale = 'en-US',
): Trail[] {
  return [...trails].sort((a, b) => {
    const aPlanned = a.source === 'planned_hikes' ? 1 : 0;
    const bPlanned = b.source === 'planned_hikes' ? 1 : 0;
    if (aPlanned !== bPlanned) return aPlanned - bPlanned;
    if (mode === 'date') {
      const aTime = trailTimestamp(a);
      const bTime = trailTimestamp(b);
      if (aTime !== bTime) return aTime > bTime ? -1 : 1;
    }
    const aName = a.name.toLocaleLowerCase(locale);
    const bName = b.name.toLocaleLowerCase(locale);
    return aName.localeCompare(bName, locale);
  });
}

export const trailKeys = {
  all: ['trails'] as const,
  map: () => ['trails', 'map'] as const,
  detail: (id: string) => ['trails', 'detail', id] as const,
  details: (id: string) => ['trails', 'details', id] as const,
  images: (id: string, revision?: string | null) =>
    revision === undefined
      ? (['trails', 'images', id] as const)
      : (['trails', 'images', id, revision] as const),
  imagePins: () => ['trails', 'image-pins'] as const,
};

const selectSorted = (trails: Trail[]) => sortTrails(trails);

/**
 * Every trail with its map coordinates, local-first.
 *
 * The local copy shows immediately; only trails changed on the server since the last sync are
 * then downloaded (everything on the very first run). Mutations update this cache and the local
 * copy directly, and the sync status poll refreshes it when another device changed something.
 */
function mapTrailsQuery(queryClient: ReturnType<typeof useQueryClient>) {
  return {
    queryKey: trailKeys.map(),
    queryFn: () => syncMapTrails((local) => queryClient.setQueryData(trailKeys.map(), local)),
    // Fresh until the sync status poll or a mutation says otherwise.
    staleTime: Number.POSITIVE_INFINITY,
    // The sync keeps array identity when nothing changed; a deep compare would walk megabytes.
    structuralSharing: false,
  };
}

/**
 * The trail list, sorted. Built from the same local copy as the map, so there is one sync path.
 * For client-side filtering, use the returned data with filterTrails().
 */
export function useTrails() {
  const queryClient = useQueryClient();
  return useQuery({ ...mapTrailsQuery(queryClient), select: selectSorted });
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

export function useTrail(id: string) {
  return useQuery({
    queryKey: trailKeys.detail(id),
    queryFn: () => trailsApi.getTrail(id),
    enabled: !!id,
  });
}

/** Every trail with its map coordinates (the same query as useTrails, unsorted). */
export function useMapTrails(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({ ...mapTrailsQuery(queryClient), enabled: options?.enabled });
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
      queryClient.setQueryData(trailKeys.detail(id), updatedTrail);
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) =>
        old?.map((t) => (t.trail_id === id ? (updatedTrail as Trail) : t)),
      );
      void mapTrailStore.apply(currentUserId(), [updatedTrail as Trail], []);
    },
  });
}

export function useDeleteTrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => trailsApi.deleteTrail(id),
    onSuccess: (_data, deletedId) => {
      // Update React Query cache directly — no refetch needed.
      queryClient.removeQueries({ queryKey: trailKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: trailKeys.details(deletedId) });
      queryClient.removeQueries({ queryKey: trailKeys.images(deletedId) });
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) =>
        old?.filter((t) => t.trail_id !== deletedId),
      );
      void mapTrailStore.apply(currentUserId(), [], [deletedId]);
      void trailImageStore.remove(deletedId);
      void queryClient.invalidateQueries({ queryKey: trailKeys.imagePins() });
    },
  });
}

export function useUploadGpx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      ...options
    }: { file: File } & Parameters<typeof trailsApi.uploadGpx>[1]) =>
      trailsApi.uploadGpx(file, options),
    onSuccess: (newTrails) => {
      // Merge new trails into React Query cache directly — no refetch.
      if (newTrails.length > 0) {
        queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) => {
          const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
          for (const trail of newTrails) {
            merged.set(trail.trail_id, trail);
          }
          return Array.from(merged.values());
        });
        void mapTrailStore.apply(currentUserId(), newTrails, []);
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
      queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) => {
        const merged = new Map((old ?? []).map((t) => [t.trail_id, t]));
        merged.set(savedTrail.trail_id, savedTrail);
        return Array.from(merged.values());
      });
      void mapTrailStore.apply(currentUserId(), [savedTrail], []);
    },
  });
}

/**
 * A trail's photos, kept on the device. They are downloaded again only when the trail's
 * `images_revision` changes (a photo was added or removed on any device).
 */
export function useTrailImages(id: string) {
  const queryClient = useQueryClient();
  const trail = useQuery({
    ...mapTrailsQuery(queryClient),
    select: (trails) => trails.find((t) => t.trail_id === id),
    enabled: !!id,
  });
  const revision = trail.data?.images_revision ?? null;

  return useQuery({
    queryKey: trailKeys.images(id, revision),
    queryFn: () => loadTrailImages(id, revision),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !!id && trail.isSuccess,
  });
}

/** Remember new photos everywhere: query cache, device copy, the trail's revision, map pins. */
function recordImagesChange(
  queryClient: ReturnType<typeof useQueryClient>,
  result: TrailImagesResponse,
): void {
  const ownerUid = currentUserId();
  const revision = result.revision ?? null;
  queryClient.removeQueries({ queryKey: trailKeys.images(result.trail_id) });
  queryClient.setQueryData(trailKeys.images(result.trail_id, revision), result);
  if (revision) void trailImageStore.put(ownerUid, result.trail_id, revision, result.images);

  const trail = queryClient
    .getQueryData<Trail[]>(trailKeys.map())
    ?.find((t) => t.trail_id === result.trail_id);
  if (trail) {
    const updated: Trail = { ...trail, images_revision: revision };
    queryClient.setQueryData<Trail[]>(trailKeys.map(), (old) =>
      old?.map((t) => (t.trail_id === updated.trail_id ? updated : t)),
    );
    void mapTrailStore.apply(ownerUid, [updated], []);
  }
  void queryClient.invalidateQueries({ queryKey: trailKeys.imagePins() });
}

export function useUploadTrailImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      trailId,
      file,
      role,
      caption,
    }: {
      trailId: string;
      file: ImageFile;
      role: 'primary' | 'secondary';
      caption?: string;
    }) => trailsApi.uploadTrailImage(trailId, file, role, caption),
    onSuccess: (result) => recordImagesChange(queryClient, result),
  });
}

export function useDeleteTrailImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trailId, imageIndex }: { trailId: string; imageIndex: number }) => {
      await trailsApi.deleteTrailImage(trailId, imageIndex);
      // The delete answers with nothing; the remaining photos carry the new revision.
      return trailsApi.getTrailImages(trailId);
    },
    onSuccess: (result) => recordImagesChange(queryClient, result),
  });
}

/**
 * Fetch lightweight image pins for the map in a single batch request.
 * Returns only thumbnail + GPS coords — no full image data.
 */
export function useImagePins(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: trailKeys.imagePins(),
    queryFn: () => trailsApi.getImagePins(),
    staleTime: Number.POSITIVE_INFINITY, // image mutations and the sync status poll invalidate this
    enabled: options?.enabled,
    select: (data) => data.pins,
  });
}
