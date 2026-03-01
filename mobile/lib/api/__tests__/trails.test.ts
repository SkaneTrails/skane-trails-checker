import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trailsApi } from '../trails';

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
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
});
