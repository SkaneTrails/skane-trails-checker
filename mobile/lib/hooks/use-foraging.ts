import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foragingApi } from '@/lib/api';
import type { ForagingSpotCreate } from '@/lib/types';

export const foragingKeys = {
  all: ['foraging'] as const,
  spots: (month?: string) => ['foraging', 'spots', month] as const,
  types: ['foraging', 'types'] as const,
};

export function useForagingSpots(month?: string) {
  return useQuery({
    queryKey: foragingKeys.spots(month),
    queryFn: () => foragingApi.getSpots(month),
  });
}

export function useForagingTypes() {
  return useQuery({
    queryKey: foragingKeys.types,
    queryFn: () => foragingApi.getTypes(),
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
