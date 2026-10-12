import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import { usePlaceCategories, usePlaces } from '../use-places';

vi.mock('@/lib/api', () => ({
  placesApi: {
    getPlaces: vi.fn(),
    getCategories: vi.fn(),
  },
}));

import { placesApi } from '@/lib/api';

const mockPlacesApi = vi.mocked(placesApi);

const samplePlace = {
  place_id: 'place1',
  name: 'Test Beach',
  lat: 56.0,
  lng: 13.5,
  categories: [{ name: 'Bad', slug: 'swimming', icon: '🏊' }],
};

describe('usePlaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches places without category filter', async () => {
    mockPlacesApi.getPlaces.mockResolvedValue([samplePlace]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => usePlaces(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([samplePlace]);
    expect(mockPlacesApi.getPlaces).toHaveBeenCalledWith(undefined);
  });

  it('passes category filter', async () => {
    mockPlacesApi.getPlaces.mockResolvedValue([samplePlace]);
    const wrapper = createQueryWrapper();

    renderHook(() => usePlaces('swimming'), { wrapper });

    await waitFor(() => {
      expect(mockPlacesApi.getPlaces).toHaveBeenCalledWith('swimming');
    });
  });

  it('does not fetch while disabled', async () => {
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => usePlaces(undefined, { enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockPlacesApi.getPlaces).not.toHaveBeenCalled();
  });
});

describe('usePlaceCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches place categories', async () => {
    const categories = { swimming: { name: 'Bad', icon: '🏊' } };
    mockPlacesApi.getCategories.mockResolvedValue(categories);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => usePlaceCategories(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(categories);
  });

  it('does not fetch while disabled', () => {
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => usePlaceCategories({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockPlacesApi.getCategories).not.toHaveBeenCalled();
  });
});
