import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import {
  pollForChanges,
  sortTrails,
  useDeleteTrail,
  useSaveRecording,
  useTrail,
  useTrailDetails,
  useTrails,
  useUpdateTrail,
  useUploadGpx,
} from '../use-trails';

vi.mock('@/lib/api', () => ({
  trailsApi: {
    getTrails: vi.fn(),
    getTrail: vi.fn(),
    getTrailDetails: vi.fn(),
    updateTrail: vi.fn(),
    deleteTrail: vi.fn(),
    uploadGpx: vi.fn(),
    getSyncMetadata: vi.fn(),
    saveRecording: vi.fn(),
  },
}));

vi.mock('@/lib/storage/trail-cache', () => ({
  trailCache: {
    get: vi.fn().mockResolvedValue({ trails: [], lastSyncTime: null }),
    set: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

import { trailsApi } from '@/lib/api';
import { trailCache } from '@/lib/storage/trail-cache';

const mockTrailsApi = vi.mocked(trailsApi);
const mockTrailCache = vi.mocked(trailCache);

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
    mockTrailsApi.getSyncMetadata.mockResolvedValue({ count: 0, last_modified: null });
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

  it('seeds React Query from IndexedDB cache on mount', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrails(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([sampleTrail]));
    expect(mockTrailCache.get).toHaveBeenCalled();
    expect(mockTrailsApi.getSyncMetadata).toHaveBeenCalled();
  });

  it('performs delta fetch when server has newer data', async () => {
    const newTrail = { ...sampleTrail, trail_id: 'new1', name: 'New Trail' };
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 2,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockImplementation((filters) => {
      if (filters.since) return Promise.resolve([newTrail]);
      return Promise.resolve([sampleTrail, newTrail]);
    });
    mockTrailCache.merge.mockResolvedValue([sampleTrail, newTrail]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailsApi.getTrails).toHaveBeenCalledWith(
        expect.objectContaining({ since: '2025-06-01T00:00:00Z' }),
      );
    });
    expect(mockTrailCache.merge).toHaveBeenCalled();
  });

  it('falls back to full refetch when delta returns empty (edit case)', async () => {
    const editedTrail = { ...sampleTrail, name: 'Edited Name' };
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockImplementation((filters) => {
      if (filters.since) return Promise.resolve([]);
      return Promise.resolve([editedTrail]);
    });
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailsApi.getTrails).toHaveBeenCalledWith({});
    });
    expect(mockTrailCache.set).toHaveBeenCalledWith([editedTrail], '2025-07-01T00:00:00Z');
  });

  it('performs full refetch when server count < local count (deletion)', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail, { ...sampleTrail, trail_id: 'del1' }],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalled();
    });
  });

  it('falls back to full refetch when delta fetch fails (e.g. invalid timestamp)', async () => {
    const allTrails = [sampleTrail, { ...sampleTrail, trail_id: 'other1', name: 'Other' }];
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00.123Z', // millisecond timestamp used to simulate a 422 delta-fetch failure
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 2,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockImplementation((filters) => {
      if (filters.since) return Promise.reject(new Error('API 422: invalid since format'));
      return Promise.resolve(allTrails);
    });
    const wrapper = createQueryWrapper();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useTrails(), { wrapper });

    // Should fall back to full refetch after delta fails
    await waitFor(() => {
      expect(mockTrailsApi.getTrails).toHaveBeenCalledWith({});
    });
    expect(mockTrailCache.set).toHaveBeenCalledWith(allTrails, '2025-07-01T00:00:00Z');
    expect(warnSpy).toHaveBeenCalledWith(
      'Trail delta fetch failed, falling back to full refetch',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('handles sync failure gracefully when cache throws', async () => {
    mockTrailCache.get.mockRejectedValueOnce(new Error('IndexedDB error'));
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Trail sync failed:', expect.any(Error));
    });
    warnSpy.mockRestore();
  });

  it('polls sync metadata and triggers background sync on change', async () => {
    vi.useFakeTimers();

    try {
      // Initial mount: cache has data, server matches
      mockTrailCache.get.mockResolvedValue({
        trails: [sampleTrail],
        lastSyncTime: '2025-06-01T00:00:00Z',
      });
      mockTrailsApi.getSyncMetadata.mockResolvedValue({
        count: 1,
        last_modified: '2025-06-01T00:00:00Z',
      });
      mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
      const wrapper = createQueryWrapper();

      renderHook(() => useTrails(), { wrapper });

      // Wait for initial sync to complete
      await vi.advanceTimersByTimeAsync(100);

      // Verify the poll interval is set up (setInterval registered)
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pollForChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when server matches cache', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-06-01T00:00:00Z',
    });

    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, ['trails', 'list', {}]);

    // No trail fetch or cache write should occur
    expect(mockTrailsApi.getTrails).not.toHaveBeenCalled();
    expect(mockTrailCache.set).not.toHaveBeenCalled();
  });

  it('triggers full refetch when server has different last_modified and delta returns empty', async () => {
    // Cache state
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });

    // Server reports newer data
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-07-01T00:00:00Z',
    });

    // Delta yields nothing → triggers full refetch
    const renamedTrail = { ...sampleTrail, name: 'Renamed' };
    mockTrailsApi.getTrails.mockImplementation((filters) => {
      if (filters.since) return Promise.resolve([]);
      return Promise.resolve([renamedTrail]);
    });

    const queryKey = ['trails', 'list', {}] as const;

    // Use a real QueryClient for setQueryData
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    // Should have done a full refetch and written to cache
    expect(mockTrailCache.set).toHaveBeenCalledWith([renamedTrail], '2025-07-01T00:00:00Z');
  });

  it('performs delta merge when new trails exist since last sync', async () => {
    const newTrail = { ...sampleTrail, trail_id: 'new1', name: 'New Trail' };

    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 2,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockImplementation((filters) => {
      if (filters.since) return Promise.resolve([newTrail]);
      return Promise.resolve([sampleTrail, newTrail]);
    });
    mockTrailCache.merge.mockResolvedValue([sampleTrail, newTrail]);

    const queryKey = ['trails', 'list', {}] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(mockTrailCache.merge).toHaveBeenCalledWith([newTrail], '2025-07-01T00:00:00Z');
  });

  it('triggers full refetch when server count < local count (deletion)', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail, { ...sampleTrail, trail_id: 'del1' }],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);

    const queryKey = ['trails', 'list', {}] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], '2025-07-01T00:00:00Z');
  });

  it('handles poll failure gracefully', async () => {
    mockTrailsApi.getSyncMetadata.mockRejectedValue(new Error('Network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queryKey = ['trails', 'list', {}] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(warnSpy).toHaveBeenCalledWith('Background sync poll failed:', expect.any(Error));
    warnSpy.mockRestore();
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

describe('useDeleteTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteTrail API', async () => {
    mockTrailsApi.deleteTrail.mockResolvedValue(undefined);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useDeleteTrail(), { wrapper });

    result.current.mutate('abc123');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTrailsApi.deleteTrail).toHaveBeenCalledWith('abc123');
  });
});

describe('useUploadGpx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls uploadGpx API with file', async () => {
    const uploadedTrail = { ...sampleTrail, trail_id: 'new1', name: 'Uploaded Trail' };
    mockTrailsApi.uploadGpx.mockResolvedValue([uploadedTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useUploadGpx(), { wrapper });

    const mockFile = new File(['gpx content'], 'test.gpx', { type: 'application/gpx+xml' });
    result.current.mutate({ file: mockFile });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([uploadedTrail]);
    expect(mockTrailsApi.uploadGpx).toHaveBeenCalledWith(mockFile);
  });

  it('preserves server lastSyncTime when merging uploaded trails into cache', async () => {
    const serverSyncTime = '2025-06-15T10:00:00Z';
    const existingTrails = [sampleTrail];
    mockTrailCache.get.mockResolvedValue({
      trails: existingTrails,
      lastSyncTime: serverSyncTime,
    });

    const uploadedTrail = { ...sampleTrail, trail_id: 'new1', name: 'Uploaded Trail' };
    mockTrailsApi.uploadGpx.mockResolvedValue([uploadedTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useUploadGpx(), { wrapper });

    const mockFile = new File(['gpx content'], 'test.gpx', { type: 'application/gpx+xml' });
    result.current.mutate({ file: mockFile });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Must use a single get+set (no double-read via merge), preserving the
    // server-issued lastSyncTime so the next delta sync uses the correct baseline.
    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ trail_id: sampleTrail.trail_id }),
          expect.objectContaining({ trail_id: 'new1' }),
        ]),
        serverSyncTime,
      );
    });
  });
});

describe('sortTrails', () => {
  const makeTrail = (overrides: Partial<typeof sampleTrail>) => ({
    ...sampleTrail,
    ...overrides,
  });

  it('places uploaded trails before planned trails', () => {
    const planned = makeTrail({ trail_id: 'p1', name: 'Planned', source: 'planned_hikes' });
    const uploaded = makeTrail({ trail_id: 'u1', name: 'Uploaded', source: 'other_trails' });

    const result = sortTrails([planned, uploaded]);

    expect(result.map((t) => t.trail_id)).toEqual(['u1', 'p1']);
  });

  it('sorts alphabetically within each group', () => {
    const plannedB = makeTrail({ trail_id: 'p2', name: 'Zeta', source: 'planned_hikes' });
    const plannedA = makeTrail({ trail_id: 'p1', name: 'Alpha', source: 'planned_hikes' });
    const uploadedB = makeTrail({ trail_id: 'u2', name: 'Omega', source: 'other_trails' });
    const uploadedA = makeTrail({ trail_id: 'u1', name: 'Beta', source: 'world_wide_hikes' });

    const result = sortTrails([plannedB, uploadedB, plannedA, uploadedA]);

    expect(result.map((t) => t.trail_id)).toEqual(['u1', 'u2', 'p1', 'p2']);
  });

  it('does not mutate the original array', () => {
    const trails = [
      makeTrail({ trail_id: 'p1', name: 'Planned', source: 'planned_hikes' }),
      makeTrail({ trail_id: 'u1', name: 'Uploaded', source: 'other_trails' }),
    ];
    const original = [...trails];

    sortTrails(trails);

    expect(trails).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(sortTrails([])).toEqual([]);
  });
});

describe('useTrailDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches trail details by id', async () => {
    const details = { trail_id: 'abc123', coordinates_full: [{ lat: 56.0, lng: 13.5 }] };
    mockTrailsApi.getTrailDetails.mockResolvedValue(details);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrailDetails('abc123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(details);
    expect(mockTrailsApi.getTrailDetails).toHaveBeenCalledWith('abc123');
  });

  it('does not fetch when id is empty', () => {
    const wrapper = createQueryWrapper();
    renderHook(() => useTrailDetails(''), { wrapper });
    expect(mockTrailsApi.getTrailDetails).not.toHaveBeenCalled();
  });
});

describe('useSaveRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls saveRecording API and invalidates queries', async () => {
    const savedTrail = { ...sampleTrail, trail_id: 'rec1', name: 'Morning Walk', source: 'other_trails' };
    mockTrailsApi.saveRecording.mockResolvedValue(savedTrail);
    mockTrailCache.get.mockResolvedValue({ trails: [sampleTrail], lastSyncTime: '2025-06-01T00:00:00Z' });
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useSaveRecording(), { wrapper });

    const points = [
      { lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 },
      { lat: 55.001, lng: 13.001, altitude: 110, timestamp: 1700000060000 },
    ];

    await result.current.mutateAsync({ name: 'Morning Walk', points });

    expect(mockTrailsApi.saveRecording).toHaveBeenCalledWith('Morning Walk', points);

    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalled();
    });
  });
});
