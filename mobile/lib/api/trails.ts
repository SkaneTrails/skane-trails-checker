import type { TrackingPoint } from '@/lib/track-to-trail';
import { toRecordingPayload } from '@/lib/track-to-trail';
import type {
  ImagePinsResponse,
  Trail,
  TrailChanges,
  TrailDetails,
  TrailImagesResponse,
  TrailUpdate,
} from '@/lib/types';
import { apiRequest } from './client';
import { prepareFormFile, type UploadFile } from './form-file';

/** File descriptor compatible with both web (File) and native (uri object). */
export type ImageFile = UploadFile;

async function postFile<T>(path: string, file: UploadFile): Promise<T> {
  const { part, dispose } = await prepareFormFile(file);
  try {
    const formData = new FormData();
    formData.append('file', part as any);
    return await apiRequest<T>(path, { method: 'POST', body: formData });
  } finally {
    dispose();
  }
}

export interface TrailFilters {
  source?: string;
  search?: string;
  min_distance_km?: number;
  max_distance_km?: number;
  status?: string;
  since?: string;
  fields?: string;
}

export interface UploadGpxOptions {
  status?: 'To Explore' | 'Explored!';
  line_color?: string;
  is_public?: boolean;
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

  /** Trails changed and trail IDs deleted since `since` (full fetch without it), with coordinates. */
  getTrailChanges(since?: string): Promise<TrailChanges> {
    return apiRequest<TrailChanges>(`/api/v1/trails/changes${buildQuery({ since })}`);
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

  uploadGpx(file: UploadFile, options: UploadGpxOptions = {}): Promise<Trail[]> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.line_color) params.set('line_color', options.line_color);
    if (options.is_public !== undefined) params.set('is_public', String(options.is_public));
    const qs = params.toString();

    return postFile<Trail[]>(`/api/v1/trails/upload${qs ? `?${qs}` : ''}`, file);
  },

  saveRecording(name: string, points: TrackingPoint[]): Promise<Trail> {
    return apiRequest<Trail>('/api/v1/trails/record', {
      method: 'POST',
      body: JSON.stringify(toRecordingPayload(name, points)),
    });
  },

  getTrailImages(id: string): Promise<TrailImagesResponse> {
    return apiRequest<TrailImagesResponse>(`/api/v1/trails/${id}/images`);
  },

  getImagePins(): Promise<ImagePinsResponse> {
    return apiRequest<ImagePinsResponse>('/api/v1/trails/image-pins');
  },

  uploadTrailImage(
    id: string,
    file: ImageFile,
    role: 'primary' | 'secondary' = 'secondary',
    caption?: string,
  ): Promise<TrailImagesResponse> {
    const params = new URLSearchParams({ role });
    if (caption) params.set('caption', caption);

    return postFile<TrailImagesResponse>(`/api/v1/trails/${id}/images?${params.toString()}`, file);
  },

  /** Deletes one photo and answers with the photos that are left and their new revision. */
  deleteTrailImage(trailId: string, imageIndex: number): Promise<TrailImagesResponse> {
    return apiRequest<TrailImagesResponse>(`/api/v1/trails/${trailId}/images/${imageIndex}`, {
      method: 'DELETE',
    });
  },
};
