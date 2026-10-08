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
    staleTime: 24 * 60 * 60 * 1000, // 24 h — places rarely change
    enabled: options?.enabled,
  });
}

export function usePlaceCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: placeKeys.categories,
    queryFn: () => placesApi.getCategories(),
    staleTime: 24 * 60 * 60 * 1000, // 24 h — categories rarely change
    enabled: options?.enabled,
  });
}
