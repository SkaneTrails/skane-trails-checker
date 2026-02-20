import { beforeEach, describe, expect, it, vi } from 'vitest';
import { placesApi } from '../places';

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../client';

const mockApiRequest = vi.mocked(apiRequest);

describe('placesApi', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  describe('getPlaces', () => {
    it('fetches all places without category filter', async () => {
      mockApiRequest.mockResolvedValue([]);
      await placesApi.getPlaces();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/places');
    });

    it('appends category query param', async () => {
      mockApiRequest.mockResolvedValue([]);
      await placesApi.getPlaces('swimming');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/places?category=swimming');
    });
  });

  describe('getCategories', () => {
    it('fetches place categories', async () => {
      mockApiRequest.mockResolvedValue({ swimming: { name: 'Bad', icon: '🏊' } });
      const result = await placesApi.getCategories();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/places/categories');
      expect(result).toEqual({ swimming: { name: 'Bad', icon: '🏊' } });
    });
  });
});
