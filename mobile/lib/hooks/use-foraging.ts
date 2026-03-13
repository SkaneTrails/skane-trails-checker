import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foragingApi } from '@/lib/api';
import type { ForagingSpotCreate, ForagingSpotUpdate, ForagingTypeUpdate } from '@/lib/types';

export const foragingKeys = {
  all: ['foraging'] as const,
  spots: (month?: string) => ['foraging', 'spots', month] as const,
  types: ['foraging', 'types'] as const,
};

export function useForagingSpots(month?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: foragingKeys.spots(month),
    queryFn: () => foragingApi.getSpots(month),
    enabled: options?.enabled,
  });
}

export function useForagingTypes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: foragingKeys.types,
    queryFn: () => foragingApi.getTypes(),
    enabled: options?.enabled,
  });
}

export function useCreateForagingSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ForagingSpotCreate) => foragingApi.createSpot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foragingKeys.all });
    },
  });
}

export function useDeleteForagingSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => foragingApi.deleteSpot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foragingKeys.all });
    },
  });
}

export function useUpdateForagingSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ForagingSpotUpdate }) =>
      foragingApi.updateSpot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foragingKeys.all });
    },
  });
}

export function useUpdateForagingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: ForagingTypeUpdate }) =>
      foragingApi.updateType(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: foragingKeys.all });
    },
  });
}
