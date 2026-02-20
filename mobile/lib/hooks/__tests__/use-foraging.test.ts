import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import {
  useCreateForagingSpot,
  useDeleteForagingSpot,
  useForagingSpots,
  useForagingTypes,
} from '../use-foraging';

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

describe('useCreateForagingSpot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a spot and invalidates queries', async () => {
    const newSpot = { type: 'Berries', lat: 56.1, lng: 13.6, notes: 'Blueberries', month: 'Jul' };
    mockForagingApi.createSpot.mockResolvedValue({ id: 'new1', ...newSpot });
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useCreateForagingSpot(), { wrapper });

    result.current.mutate(newSpot);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockForagingApi.createSpot).toHaveBeenCalledWith(newSpot);
  });
});

describe('useDeleteForagingSpot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a spot and invalidates queries', async () => {
    mockForagingApi.deleteSpot.mockResolvedValue(undefined);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useDeleteForagingSpot(), { wrapper });

    result.current.mutate('spot1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockForagingApi.deleteSpot).toHaveBeenCalledWith('spot1');
  });
});
