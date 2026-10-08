import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../client';
import { syncApi } from '../sync';

describe('syncApi', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('fetches the sync status', async () => {
    const status = {
      trails: 'v1',
      places: null,
      foraging_spots: 'v3',
      foraging_types: null,
      images: 'v5',
      scope: 'group:g1',
    };
    vi.mocked(apiRequest).mockResolvedValue(status);

    expect(await syncApi.getStatus()).toEqual(status);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/sync/status');
  });
});
