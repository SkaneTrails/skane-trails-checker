import type { Place, PlaceCategory } from '@/lib/types';
import { apiRequest } from './client';

export const placesApi = {
  getPlaces(category?: string): Promise<Place[]> {
    const query = category ? `?category=${category}` : '';
    return apiRequest<Place[]>(`/api/v1/places${query}`);
  },

  getCategories(): Promise<Record<string, PlaceCategory>> {
    return apiRequest<Record<string, PlaceCategory>>('/api/v1/places/categories');
  },
};
