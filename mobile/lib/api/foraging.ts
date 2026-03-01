import type { ForagingSpot, ForagingSpotCreate, ForagingType } from '@/lib/types';
import { apiRequest } from './client';

export const foragingApi = {
  getSpots(month?: string): Promise<ForagingSpot[]> {
    const query = month ? `?month=${month}` : '';
    return apiRequest<ForagingSpot[]>(`/api/v1/foraging/spots${query}`);
  },

  createSpot(data: ForagingSpotCreate): Promise<ForagingSpot> {
    return apiRequest<ForagingSpot>('/api/v1/foraging/spots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSpot(id: string, data: Partial<ForagingSpotCreate>): Promise<void> {
    return apiRequest<void>(`/api/v1/foraging/spots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteSpot(id: string): Promise<void> {
    return apiRequest<void>(`/api/v1/foraging/spots/${id}`, {
      method: 'DELETE',
    });
  },

  getTypes(): Promise<ForagingType[]> {
    return apiRequest<ForagingType[]>('/api/v1/foraging/types');
  },

  createType(data: { name: string; icon: string; color?: string }): Promise<ForagingType> {
    return apiRequest<ForagingType>('/api/v1/foraging/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteType(name: string): Promise<void> {
    return apiRequest<void>(`/api/v1/foraging/types/${name}`, {
      method: 'DELETE',
    });
  },
};
