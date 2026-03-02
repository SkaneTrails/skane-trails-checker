import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrailFilters } from '@/lib/api';
import { trailsApi } from '@/lib/api';
import type { TrailUpdate } from '@/lib/types';

export const trailKeys = {
  all: ['trails'] as const,
  list: (filters: TrailFilters) => ['trails', 'list', filters] as const,
  detail: (id: string) => ['trails', 'detail', id] as const,
  details: (id: string) => ['trails', 'details', id] as const,
};

export function useTrails(filters: TrailFilters = {}) {
  return useQuery({
    queryKey: trailKeys.list(filters),
    queryFn: () => trailsApi.getTrails(filters),
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
    },
  });
}

export function useDeleteTrail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => trailsApi.deleteTrail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
    },
  });
}

export function useUploadGpx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, source }: { file: File; source?: string }) =>
      trailsApi.uploadGpx(file, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trailKeys.all });
    },
  });
}
