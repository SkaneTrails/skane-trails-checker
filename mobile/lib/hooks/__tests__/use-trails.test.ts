import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import {
  SYNC_POLL_INTERVAL,
  filterTrails,
  pollForChanges,
  sortTrails,
  useDeleteTrail,
  useMapTrails,
  useImagePins,
  useSaveRecording,
  useTrail,
  useTrailDetails,
  useTrailImages,
  useTrails,
  useUpdateTrail,
  useUploadGpx,
  useUploadTrailImage,
  useDeleteTrailImage,
} from '../use-trails';

vi.mock('@/lib/api', () => ({
  trailsApi: {
    getTrails: vi.fn(),
    getTrailSummaries: vi.fn(),
    getTrail: vi.fn(),
    getTrailDetails: vi.fn(),
    updateTrail: vi.fn(),
    deleteTrail: vi.fn(),
    uploadGpx: vi.fn(),
    getSyncMetadata: vi.fn(),
    saveRecording: vi.fn(),
    getTrailImages: vi.fn(),
    getImagePins: vi.fn(),
    uploadTrailImage: vi.fn(),
    deleteTrailImage: vi.fn(),
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
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
    mockTrailsApi.getSyncMetadata.mockResolvedValue({ count: 0, last_modified: null });
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useTrails(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTrail]);
    expect(mockTrailsApi.getTrailSummaries).toHaveBeenCalledWith({});
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
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
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
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.resolve([newTrail]);
      return Promise.resolve([sampleTrail, newTrail]);
    });
    mockTrailCache.merge.mockResolvedValue([sampleTrail, newTrail]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailsApi.getTrailSummaries).toHaveBeenCalledWith(
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
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.resolve([]);
      return Promise.resolve([editedTrail]);
    });
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailsApi.getTrailSummaries).toHaveBeenCalledWith({});
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
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
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
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.reject(new Error('API 422: invalid since format'));
      return Promise.resolve(allTrails);
    });
    const wrapper = createQueryWrapper();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useTrails(), { wrapper });

    // Should fall back to full refetch after delta fails
    await waitFor(() => {
      expect(mockTrailsApi.getTrailSummaries).toHaveBeenCalledWith({});
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
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Trail sync failed:', expect.any(Error));
    });
    warnSpy.mockRestore();
  });

  it('uses current time as syncTime when server last_modified is null on first load', async () => {
    mockTrailCache.get.mockResolvedValue({ trails: [], lastSyncTime: null });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({ count: 1, last_modified: null });
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], expect.any(String));
    });
  });

  it('schedules polling with SYNC_POLL_INTERVAL after sync completes', async () => {
    vi.useFakeTimers();

    // Initial mount: cache has data, server matches
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    renderHook(() => useTrails(), { wrapper });

    // Wait for initial sync to complete
    await vi.waitFor(() => {
      expect(mockTrailsApi.getSyncMetadata).toHaveBeenCalled();
    });

    // Clear call counts before advancing timer
    mockTrailsApi.getSyncMetadata.mockClear();

    // Advance timer to trigger poll callback
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);

    expect(mockTrailsApi.getSyncMetadata).toHaveBeenCalled();

    vi.useRealTimers();
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

    await pollForChanges(qc as any, ['trails', 'list']);

    // No trail fetch or cache write should occur
    expect(mockTrailsApi.getTrailSummaries).not.toHaveBeenCalled();
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
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.resolve([]);
      return Promise.resolve([renamedTrail]);
    });

    const queryKey = ['trails', 'list'] as const;

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
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.resolve([newTrail]);
      return Promise.resolve([sampleTrail, newTrail]);
    });
    mockTrailCache.merge.mockResolvedValue([sampleTrail, newTrail]);

    const queryKey = ['trails', 'list'] as const;
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
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);

    const queryKey = ['trails', 'list'] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], '2025-07-01T00:00:00Z');
  });

  it('handles poll failure gracefully', async () => {
    mockTrailsApi.getSyncMetadata.mockRejectedValue(new Error('Network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const queryKey = ['trails', 'list'] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(warnSpy).toHaveBeenCalledWith('Background sync poll failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('performs full fetch when cache is empty (first device sync)', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [],
      lastSyncTime: null,
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 1,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);

    const queryKey = ['trails', 'list'] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(mockTrailsApi.getTrailSummaries).toHaveBeenCalledWith({});
    expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], '2025-07-01T00:00:00Z');
  });

  it('falls back to full refetch when delta fetch throws during poll', async () => {
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({
      count: 2,
      last_modified: '2025-07-01T00:00:00Z',
    });
    mockTrailsApi.getTrailSummaries.mockImplementation((filters?: { since?: string }) => {
      if (filters?.since) return Promise.reject(new Error('Server error'));
      return Promise.resolve([sampleTrail]);
    });

    const queryKey = ['trails', 'list'] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], '2025-07-01T00:00:00Z');
  });

  it('uses current time when last_modified is null (first-load sync)', async () => {
    mockTrailCache.get.mockResolvedValue({ trails: [], lastSyncTime: null });
    mockTrailsApi.getSyncMetadata.mockResolvedValue({ count: 1, last_modified: null });
    mockTrailsApi.getTrailSummaries.mockResolvedValue([sampleTrail]);

    const queryKey = ['trails', 'list'] as const;
    const { QueryClient } = await import('@tanstack/react-query');
    const qc = new QueryClient();

    await pollForChanges(qc as any, queryKey);

    // Should still call set — the syncTime will be new Date().toISOString()
    expect(mockTrailCache.set).toHaveBeenCalledWith([sampleTrail], expect.any(String));
  });
});

describe('useMapTrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches full trail data for map rendering', async () => {
    mockTrailsApi.getTrails.mockResolvedValue([sampleTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useMapTrails(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTrail]);
    expect(mockTrailsApi.getTrails).toHaveBeenCalledWith({});
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

  it('calls updateTrail API and updates cache on success', async () => {
    const updatedTrail = { ...sampleTrail, status: 'Explored!' as const };
    mockTrailsApi.updateTrail.mockResolvedValue(updatedTrail);
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });

    // Pre-seed query cache so setQueryData callbacks execute their mapping
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['trails', 'list'], [sampleTrail]);
    queryClient.setQueryData(['trails', 'map'], [sampleTrail]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateTrail(), { wrapper });

    result.current.mutate({ id: 'abc123', data: { status: 'Explored!' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTrailsApi.updateTrail).toHaveBeenCalledWith('abc123', { status: 'Explored!' });
    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalledWith(
        [updatedTrail],
        '2025-06-01T00:00:00Z',
      );
    });
    // Verify the setQueryData callbacks updated both caches
    expect(queryClient.getQueryData(['trails', 'list'])).toEqual([updatedTrail]);
    expect(queryClient.getQueryData(['trails', 'map'])).toEqual([updatedTrail]);
  });
});

describe('useDeleteTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteTrail API and updates cache on success', async () => {
    mockTrailsApi.deleteTrail.mockResolvedValue(undefined);
    mockTrailCache.get.mockResolvedValue({
      trails: [sampleTrail],
      lastSyncTime: '2025-06-01T00:00:00Z',
    });

    // Pre-seed query cache so setQueryData callbacks execute their filter
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['trails', 'list'], [sampleTrail]);
    queryClient.setQueryData(['trails', 'map'], [sampleTrail]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteTrail(), { wrapper });

    result.current.mutate('abc123');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTrailsApi.deleteTrail).toHaveBeenCalledWith('abc123');
    await waitFor(() => {
      expect(mockTrailCache.set).toHaveBeenCalledWith([], '2025-06-01T00:00:00Z');
    });
    // Verify the setQueryData callbacks removed the trail from both caches
    expect(queryClient.getQueryData(['trails', 'list'])).toEqual([]);
    expect(queryClient.getQueryData(['trails', 'map'])).toEqual([]);
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
    expect(mockTrailsApi.uploadGpx).toHaveBeenCalledWith(mockFile, {});
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

    // Pre-seed both caches so setQueryData callbacks execute
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['trails', 'list'], existingTrails);
    queryClient.setQueryData(['trails', 'map'], existingTrails);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

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

describe('filterTrails', () => {
  const makeTrail = (overrides: Record<string, unknown>) => ({
    ...sampleTrail,
    ...overrides,
  }) as typeof sampleTrail;

  const trails = [
    makeTrail({ trail_id: '1', name: 'Hovdala Castle Loop', status: 'Explored!', length_km: 8.2 }),
    makeTrail({ trail_id: '2', name: 'Söderåsen Ridge', status: 'To Explore', length_km: 15.0 }),
    makeTrail({ trail_id: '3', name: 'Hovdala Lake Trail', status: 'To Explore', length_km: 5.5 }),
  ];

  it('returns all trails when no filters provided', () => {
    expect(filterTrails(trails, {})).toEqual(trails);
  });

  it('filters by search (case-insensitive substring)', () => {
    const result = filterTrails(trails, { search: 'hovdala' });
    expect(result.map((t) => t.trail_id)).toEqual(['1', '3']);
  });

  it('filters by status', () => {
    const result = filterTrails(trails, { status: 'To Explore' });
    expect(result.map((t) => t.trail_id)).toEqual(['2', '3']);
  });

  it('filters by min_distance_km', () => {
    const result = filterTrails(trails, { min_distance_km: 10 });
    expect(result.map((t) => t.trail_id)).toEqual(['2']);
  });

  it('filters by max_distance_km', () => {
    const result = filterTrails(trails, { max_distance_km: 8.2 });
    expect(result.map((t) => t.trail_id)).toEqual(['1', '3']);
  });

  it('combines multiple filters', () => {
    const result = filterTrails(trails, { search: 'hovdala', status: 'To Explore' });
    expect(result.map((t) => t.trail_id)).toEqual(['3']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterTrails(trails, { search: 'nonexistent' })).toEqual([]);
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

    // Pre-seed both caches so setQueryData callbacks execute
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['trails', 'list'], [sampleTrail]);
    queryClient.setQueryData(['trails', 'map'], [sampleTrail]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

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

describe('useTrailImages', () => {
  it('fetches images for a trail', async () => {
    const images = { trail_id: 'abc', images: [{ image_data: 'b64', role: 'primary', lat: 55.0, lng: 13.0, caption: null }] };
    mockTrailsApi.getTrailImages.mockResolvedValue(images);

    const { result } = renderHook(() => useTrailImages('abc'), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(images);
  });
});

describe('useUploadTrailImage', () => {
  it('uploads an image and updates cache', async () => {
    const response = { trail_id: 'abc', images: [{ image_data: 'b64', role: 'primary', lat: null, lng: null, caption: null }] };
    mockTrailsApi.uploadTrailImage.mockResolvedValue(response);

    const { result } = renderHook(() => useUploadTrailImage(), { wrapper: createQueryWrapper() });

    const file = new File(['img'], 'photo.jpg');
    await result.current.mutateAsync({ trailId: 'abc', file, role: 'primary' });

    expect(mockTrailsApi.uploadTrailImage).toHaveBeenCalledWith('abc', file, 'primary', undefined);
  });

  it('invalidates imagePins cache after upload', async () => {
    const response = { trail_id: 'abc', images: [{ image_data: 'b64', role: 'primary', lat: 55.5, lng: 13.2, caption: null }] };
    mockTrailsApi.uploadTrailImage.mockResolvedValue(response);
    mockTrailsApi.getImagePins.mockResolvedValue({
      pins: [{ trail_id: 'abc', lat: 55.5, lng: 13.2, thumbnail: 'thumb' }],
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed imagePins cache so invalidation triggers a refetch
    queryClient.setQueryData(['trails', 'image-pins'], { pins: [] });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    // Mount useImagePins so the query is active and will refetch on invalidation
    renderHook(() => useImagePins({ enabled: true }), { wrapper });

    const { result } = renderHook(() => useUploadTrailImage(), { wrapper });

    const file = new File(['img'], 'photo.jpg');
    await result.current.mutateAsync({ trailId: 'abc', file, role: 'primary' });

    await waitFor(() => {
      expect(mockTrailsApi.getImagePins).toHaveBeenCalled();
    });
  });
});

describe('useDeleteTrailImage', () => {
  it('deletes an image by index', async () => {
    mockTrailsApi.deleteTrailImage.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteTrailImage(), { wrapper: createQueryWrapper() });

    await result.current.mutateAsync({ trailId: 'abc', imageIndex: 0 });

    expect(mockTrailsApi.deleteTrailImage).toHaveBeenCalledWith('abc', 0);
  });

  it('optimistically removes image from cache on success', async () => {
    mockTrailsApi.deleteTrailImage.mockResolvedValue(undefined);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Seed cache with existing images
    queryClient.setQueryData(['trails', 'images', 'abc'], {
      trail_id: 'abc',
      images: [
        { image_data: 'img0', role: 'primary', lat: null, lng: null, caption: null },
        { image_data: 'img1', role: 'secondary', lat: null, lng: null, caption: null },
      ],
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteTrailImage(), { wrapper });

    await result.current.mutateAsync({ trailId: 'abc', imageIndex: 0 });

    await waitFor(() => {
      const cached = queryClient.getQueryData(['trails', 'images', 'abc']) as any;
      expect(cached.images).toHaveLength(1);
      expect(cached.images[0].image_data).toBe('img1');
    });
  });

  it('invalidates imagePins cache after delete', async () => {
    mockTrailsApi.deleteTrailImage.mockResolvedValue(undefined);
    mockTrailsApi.getImagePins.mockResolvedValue({
      pins: [{ trail_id: 'abc', lat: 55.5, lng: 13.2, thumbnail: 'thumb' }],
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['trails', 'images', 'abc'], {
      trail_id: 'abc',
      images: [{ image_data: 'img0', role: 'primary', lat: null, lng: null, caption: null }],
    });
    // Seed imagePins so invalidation triggers refetch
    queryClient.setQueryData(['trails', 'image-pins'], { pins: [] });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    // Mount useImagePins so the query is active
    renderHook(() => useImagePins({ enabled: true }), { wrapper });

    const { result } = renderHook(() => useDeleteTrailImage(), { wrapper });

    await result.current.mutateAsync({ trailId: 'abc', imageIndex: 0 });

    await waitFor(() => {
      expect(mockTrailsApi.getImagePins).toHaveBeenCalled();
    });
  });
});

describe('useImagePins', () => {
  it('returns undefined when disabled', () => {
    const { result } = renderHook(() => useImagePins({ enabled: false }), { wrapper: createQueryWrapper() });
    expect(result.current.data).toBeUndefined();
  });

  it('fetches image pins when enabled', async () => {
    mockTrailsApi.getImagePins.mockResolvedValue({
      pins: [{ trail_id: 't1', lat: 55.5, lng: 13.2, thumbnail: 'thumb' }],
    });

    const { result } = renderHook(() => useImagePins({ enabled: true }), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data![0]).toEqual({ trail_id: 't1', lat: 55.5, lng: 13.2, thumbnail: 'thumb' });
  });
});
