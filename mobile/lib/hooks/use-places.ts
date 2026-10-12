import { useQuery } from '@tanstack/react-query';
import { placesApi } from '@/lib/api';

export const placeKeys = {
  all: ['places'] as const,
  list: (category?: string) => ['places', 'list', category] as const,
  categories: ['places', 'categories'] as const,
};

export function usePlaces(category?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: placeKeys.list(category),
    queryFn: () => placesApi.getPlaces(category),
    staleTime: Number.POSITIVE_INFINITY, // the sync status poll refetches when they change
    enabled: options?.enabled,
  });
}

export function usePlaceCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: placeKeys.categories,
    queryFn: () => placesApi.getCategories(),
    staleTime: Number.POSITIVE_INFINITY, // the sync status poll refetches when they change
    enabled: options?.enabled,
  });
}
