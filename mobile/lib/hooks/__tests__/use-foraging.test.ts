import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import { useForagingSpots, useForagingTypes } from '../use-foraging';

vi.mock('@/lib/api', () => ({
  foragingApi: {
    getSpots: vi.fn(),
    getTypes: vi.fn(),
    createSpot: vi.fn(),
    deleteSpot: vi.fn(),
    updateSpot: vi.fn(),
    createType: vi.fn(),
    deleteType: vi.fn(),
  },
}));

import { foragingApi } from '@/lib/api';

const mockForagingApi = vi.mocked(foragingApi);

const sampleSpot = {
  id: 'spot1',
  type: 'Mushrooms',
  lat: 56.0,
  lng: 13.5,
  notes: 'Nice patch',
  month: 'Sep',
};

describe('useForagingSpots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches spots without filter', async () => {
    mockForagingApi.getSpots.mockResolvedValue([sampleSpot]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useForagingSpots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleSpot]);
    expect(mockForagingApi.getSpots).toHaveBeenCalledWith(undefined);
  });

  it('passes month filter', async () => {
    mockForagingApi.getSpots.mockResolvedValue([sampleSpot]);
    const wrapper = createQueryWrapper();

    renderHook(() => useForagingSpots('Sep'), { wrapper });

    await waitFor(() => {
      expect(mockForagingApi.getSpots).toHaveBeenCalledWith('Sep');
    });
  });
});

describe('useForagingTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches foraging types', async () => {
    const types = [{ name: 'Mushrooms', icon: '🍄', color: '#8B4513' }];
    mockForagingApi.getTypes.mockResolvedValue(types);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useForagingTypes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(types);
  });
});
