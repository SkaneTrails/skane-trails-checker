import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import {
  useDeleteTrail,
  useTrail,
  useTrailDetails,
  useTrails,
  useUpdateTrail,
} from '../use-trails';

vi.mock('@/lib/api', () => ({
  trailsApi: {
    getTrails: vi.fn(),
    getTrail: vi.fn(),
    getTrailDetails: vi.fn(),
    updateTrail: vi.fn(),
    deleteTrail: vi.fn(),
  },
}));

import { trailsApi } from '@/lib/api';

const mockTrailsApi = vi.mocked(trailsApi);

const sampleTrail = {
  trail_id: 'abc123',
  name: 'Test Trail',
  status: 'To Explore' as const,
  source: 'planned_hikes',
  length_km: 12.5,
  difficulty: 'Unknown',
  coordinates_map: [{ lat: 56.0, lng: 13.5 }],
  bounds: { north: 56.1, south: 55.9, east: 13.6, west: 13.4 },
  center: { lat: 56.0, lng: 13.5 },
  last_updated: '2025-01-01T00:00:00Z',
};

describe('useTrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches trails on mount', async () => {
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrails(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTrail]);
    expect(mockTrailsApi.getTrails).toHaveBeenCalledWith({});
  });

  it('passes filters to API', async () => {
    mockTrailsApi.getTrails.mockResolvedValue([]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails({ source: 'planned_hikes' }), { wrapper });

    await waitFor(() => {
      expect(mockTrailsApi.getTrails).toHaveBeenCalledWith({ source: 'planned_hikes' });
    });
  });
});

describe('useTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a single trail by id', async () => {
    mockTrailsApi.getTrail.mockResolvedValue(sampleTrail);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrail('abc123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleTrail);
  });
});

describe('useUpdateTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateTrail API and returns mutation', async () => {
    mockTrailsApi.updateTrail.mockResolvedValue({ ...sampleTrail, status: 'Explored!' });
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useUpdateTrail(), { wrapper });

    result.current.mutate({ id: 'abc123', data: { status: 'Explored!' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTrailsApi.updateTrail).toHaveBeenCalledWith('abc123', { status: 'Explored!' });
  });
});

describe('useTrailDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches trail details by id', async () => {
    const details = { ...sampleTrail, coordinates_full: [{ lat: 56.0, lng: 13.5 }] };
    mockTrailsApi.getTrailDetails.mockResolvedValue(details);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrailDetails('abc123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(details);
    expect(mockTrailsApi.getTrailDetails).toHaveBeenCalledWith('abc123');
  });

  it('does not fetch when id is empty', () => {
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrailDetails(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockTrailsApi.getTrailDetails).not.toHaveBeenCalled();
  });
});

describe('useDeleteTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a trail and invalidates queries', async () => {
    mockTrailsApi.deleteTrail.mockResolvedValue(undefined);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useDeleteTrail(), { wrapper });

    result.current.mutate('abc123');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTrailsApi.deleteTrail).toHaveBeenCalledWith('abc123');
  });
});
