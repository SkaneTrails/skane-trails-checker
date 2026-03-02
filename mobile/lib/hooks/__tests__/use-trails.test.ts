import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';
import { useDeleteTrail, useTrail, useTrails, useUpdateTrail, useUploadGpx } from '../use-trails';

vi.mock('@/lib/api', () => ({
  trailsApi: {
    getTrails: vi.fn(),
    getTrail: vi.fn(),
    getTrailDetails: vi.fn(),
    updateTrail: vi.fn(),
    deleteTrail: vi.fn(),
    uploadGpx: vi.fn(),
    getSyncMetadata: vi.fn(),
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
      lastSyncTime: '2025-06-01T00:00:00.123Z', // millisecond timestamp (was rejected by API)
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
    );
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

  it('calls uploadGpx API with file and source', async () => {
    const uploadedTrail = { ...sampleTrail, trail_id: 'new1', name: 'Uploaded Trail' };
    mockTrailsApi.uploadGpx.mockResolvedValue([uploadedTrail]);
    const wrapper = createQueryWrapper();

    const { result } = renderHook(() => useUploadGpx(), { wrapper });

    const mockFile = new File(['gpx content'], 'test.gpx', { type: 'application/gpx+xml' });
    result.current.mutate({ file: mockFile, source: 'other_trails' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([uploadedTrail]);
    expect(mockTrailsApi.uploadGpx).toHaveBeenCalledWith(mockFile, 'other_trails');
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
