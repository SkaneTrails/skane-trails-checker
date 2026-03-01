import { useQuery } from '@tanstack/react-query';
import { placesApi } from '@/lib/api';

export const placeKeys = {
  all: ['places'] as const,
  list: (category?: string) => ['places', 'list', category] as const,
  categories: ['places', 'categories'] as const,
};

export function usePlaces(category?: string) {
  return useQuery({
    queryKey: placeKeys.list(category),
    queryFn: () => placesApi.getPlaces(category),
  });
}

export function usePlaceCategories() {
  return useQuery({
    queryKey: placeKeys.categories,
    queryFn: () => placesApi.getCategories(),
  });
}
