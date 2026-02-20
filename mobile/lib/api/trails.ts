import type { Trail, TrailDetails, TrailUpdate } from '@/lib/types';
import { apiRequest } from './client';

export interface TrailFilters {
  source?: string;
  search?: string;
  min_distance_km?: number;
  max_distance_km?: number;
  status?: string;
}

function buildQuery(filters: TrailFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const trailsApi = {
  getTrails(filters: TrailFilters = {}): Promise<Trail[]> {
    return apiRequest<Trail[]>(`/api/v1/trails${buildQuery(filters)}`);
  },

  getTrail(id: string): Promise<Trail> {
    return apiRequest<Trail>(`/api/v1/trails/${id}`);
  },

  getTrailDetails(id: string): Promise<TrailDetails> {
    return apiRequest<TrailDetails>(`/api/v1/trails/${id}/details`);
  },

  updateTrail(id: string, data: TrailUpdate): Promise<Trail> {
    return apiRequest<Trail>(`/api/v1/trails/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteTrail(id: string): Promise<void> {
    return apiRequest<void>(`/api/v1/trails/${id}`, {
      method: 'DELETE',
    });
  },
};
