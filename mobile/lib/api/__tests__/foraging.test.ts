import { beforeEach, describe, expect, it, vi } from 'vitest';
import { foragingApi } from '../foraging';

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../client';

const mockApiRequest = vi.mocked(apiRequest);

describe('foragingApi', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  describe('getSpots', () => {
    it('fetches all spots without month filter', async () => {
      mockApiRequest.mockResolvedValue([]);
      await foragingApi.getSpots();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/foraging/spots');
    });

    it('appends month query param', async () => {
      mockApiRequest.mockResolvedValue([]);
      await foragingApi.getSpots('Sep');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/foraging/spots?month=Sep');
    });
  });

  describe('createSpot', () => {
    it('sends POST with spot data', async () => {
      const spotData = {
        type: 'Mushrooms',
        lat: 56.0,
        lng: 13.5,
        notes: 'Big patch',
        month: 'Sep',
      };
      mockApiRequest.mockResolvedValue({ id: 'new', ...spotData });
      await foragingApi.createSpot(spotData);
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/foraging/spots', {
        method: 'POST',
        body: JSON.stringify(spotData),
      });
    });
  });

  describe('deleteSpot', () => {
    it('sends DELETE request', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      await foragingApi.deleteSpot('spot1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/foraging/spots/spot1', {
        method: 'DELETE',
      });
    });
  });

  describe('getTypes', () => {
    it('fetches foraging types', async () => {
      mockApiRequest.mockResolvedValue([{ name: 'Mushrooms', icon: '🍄' }]);
      const result = await foragingApi.getTypes();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/foraging/types');
      expect(result).toEqual([{ name: 'Mushrooms', icon: '🍄' }]);
    });
  });
});
