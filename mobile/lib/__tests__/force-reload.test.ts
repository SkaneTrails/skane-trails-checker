import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storage/map-trail-store', () => ({
  mapTrailStore: { clear: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/storage/trail-cache', () => ({
  trailCache: { clear: vi.fn().mockResolvedValue(undefined) },
}));

import { mapTrailStore } from '@/lib/storage/map-trail-store';
import { trailCache } from '@/lib/storage/trail-cache';
import { forceReload } from '../force-reload';

describe('forceReload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the local trail stores', async () => {
    await forceReload(new QueryClient());

    expect(mapTrailStore.clear).toHaveBeenCalledOnce();
    expect(trailCache.clear).toHaveBeenCalledOnce();
  });

  it('resets every query so mounted screens refetch', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['places'], [{ id: 1 }]);
    const reset = vi.spyOn(queryClient, 'resetQueries');

    await forceReload(queryClient);

    expect(reset).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['places'])).toBeUndefined();
  });

  it('clears the local stores before resetting, so the refetch starts from nothing', async () => {
    const order: string[] = [];
    vi.mocked(mapTrailStore.clear).mockImplementation(async () => {
      order.push('map-store');
    });
    vi.mocked(trailCache.clear).mockImplementation(async () => {
      order.push('trail-cache');
    });
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, 'resetQueries').mockImplementation(async () => {
      order.push('reset');
    });

    await forceReload(queryClient);

    expect(order.indexOf('reset')).toBe(2);
  });
});
