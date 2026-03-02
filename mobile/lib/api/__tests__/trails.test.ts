import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockFetch.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends POST with FormData and returns trails', async () => {
      const uploaded = [{ trail_id: 'new1', name: 'Uploaded' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(uploaded),
      });

      const file = new File(['<gpx/>'], 'test.gpx', { type: 'application/gpx+xml' });
      const result = await trailsApi.uploadGpx(file, 'other_trails');

      expect(result).toEqual(uploaded);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/trails/upload?source=other_trails'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      const file = new File(['<gpx/>'], 'test.gpx');
      await expect(trailsApi.uploadGpx(file)).rejects.toThrow('API Error 400: Bad request');
    });
  });
});
