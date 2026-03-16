import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trailsApi } from '../trails';

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      public status: number,
      public reason: string,
    ) {
      super(`API Error ${status}: ${reason}`);
      this.name = 'ApiClientError';
    }
  },
  API_BASE_URL: 'http://localhost:8000',
}));

import { apiRequest } from '../client';

const mockApiRequest = vi.mocked(apiRequest);

describe('trailsApi', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  describe('getTrails', () => {
    it('fetches all trails without filters', async () => {
      mockApiRequest.mockResolvedValue([]);
      await trailsApi.getTrails();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails');
    });

    it('appends query params for filters', async () => {
      mockApiRequest.mockResolvedValue([]);
      await trailsApi.getTrails({ source: 'planned_hikes', search: 'mountain' });
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/v1/trails?source=planned_hikes&search=mountain',
      );
    });

    it('omits undefined/empty filter values', async () => {
      mockApiRequest.mockResolvedValue([]);
      await trailsApi.getTrails({ source: '', search: undefined });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails');
    });
  });

  describe('getTrail', () => {
    it('fetches a single trail', async () => {
      mockApiRequest.mockResolvedValue({ trail_id: 'abc', name: 'Test' });
      const result = await trailsApi.getTrail('abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/abc');
      expect(result).toEqual({ trail_id: 'abc', name: 'Test' });
    });
  });

  describe('getTrailDetails', () => {
    it('fetches trail details', async () => {
      mockApiRequest.mockResolvedValue({ trail_id: 'abc', coordinates_full: [] });
      await trailsApi.getTrailDetails('abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/abc/details');
    });
  });

  describe('updateTrail', () => {
    it('sends PATCH with update data', async () => {
      mockApiRequest.mockResolvedValue({ trail_id: 'abc', status: 'Explored!' });
      await trailsApi.updateTrail('abc', { status: 'Explored!' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/abc', {
        method: 'PATCH',
        body: '{"status":"Explored!"}',
      });
    });
  });

  describe('deleteTrail', () => {
    it('sends DELETE request', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      await trailsApi.deleteTrail('abc');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/abc', {
        method: 'DELETE',
      });
    });
  });

  describe('getSyncMetadata', () => {
    it('fetches sync metadata', async () => {
      mockApiRequest.mockResolvedValue({ count: 42, last_modified: '2026-03-01T12:00:00Z' });
      const result = await trailsApi.getSyncMetadata();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/sync');
      expect(result).toEqual({ count: 42, last_modified: '2026-03-01T12:00:00Z' });
    });
  });

  describe('uploadGpx', () => {
    it('sends POST with FormData and returns trails', async () => {
      const uploaded = [{ trail_id: 'new1', name: 'Uploaded' }];
      mockApiRequest.mockResolvedValue(uploaded);

      const file = new File(['<gpx/>'], 'test.gpx', { type: 'application/gpx+xml' });
      const result = await trailsApi.uploadGpx(file, 'other_trails');

      expect(result).toEqual(uploaded);
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/v1/trails/upload?source=other_trails',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
    });

    it('throws on API error', async () => {
      mockApiRequest.mockRejectedValue(new Error('API Error 400: Bad request'));

      const file = new File(['<gpx/>'], 'test.gpx');
      await expect(trailsApi.uploadGpx(file)).rejects.toThrow('API Error 400: Bad request');
    });
  });

  describe('saveRecording', () => {
    it('sends POST with recording payload', async () => {
      const saved = { trail_id: 'rec1', name: 'Morning Hike' };
      mockApiRequest.mockResolvedValue(saved);

      const points = [
        { lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 },
        { lat: 55.001, lng: 13.001, altitude: 110, timestamp: 1700000060000 },
      ];
      const result = await trailsApi.saveRecording('Morning Hike', points, 'gps_recording');

      expect(result).toEqual(saved);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/trails/record', {
        method: 'POST',
        body: expect.any(String),
      });

      const body = JSON.parse(mockApiRequest.mock.calls[0][1].body as string);
      expect(body.name).toBe('Morning Hike');
      expect(body.source).toBe('gps_recording');
    });

    it('sends POST without source when not provided', async () => {
      mockApiRequest.mockResolvedValue({ trail_id: 'rec2', name: 'Walk' });

      const points = [
        { lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 },
      ];
      await trailsApi.saveRecording('Walk', points);

      const body = JSON.parse(mockApiRequest.mock.calls[0][1].body as string);
      expect(body.name).toBe('Walk');
    });
  });
});
