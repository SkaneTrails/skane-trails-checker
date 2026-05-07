import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPersister } from '../../storage/query-persister.native';

function makePersistedClient(overrides?: Partial<PersistedClient>): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: '',
    clientState: {
      mutations: [],
      queries: [
        {
          queryKey: ['test'],
          queryHash: '["test"]',
          state: {
            data: { hello: 'world' },
            dataUpdateCount: 1,
            dataUpdatedAt: Date.now(),
            error: null,
            errorUpdateCount: 0,
            errorUpdatedAt: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            fetchStatus: 'idle',
            isInvalidated: false,
            status: 'success',
          },
        },
      ],
    },
    ...overrides,
  };
}

describe('createPersister (native/AsyncStorage)', () => {
  let persister: ReturnType<typeof createPersister>;
  const mockStorage = vi.mocked(AsyncStorage);

  beforeEach(() => {
    persister = createPersister();
    mockStorage.getItem.mockReset();
    mockStorage.setItem.mockReset();
    mockStorage.removeItem.mockReset();
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockResolvedValue(undefined);
    mockStorage.removeItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined when no data persisted', async () => {
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
  });

  it('persists and restores a client', async () => {
    const client = makePersistedClient();

    await persister.persistClient(client);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      '@skane_trails_query_cache',
      JSON.stringify(client),
    );

    mockStorage.getItem.mockResolvedValue(JSON.stringify(client));
    const restored = await persister.restoreClient();
    expect(restored).toBeDefined();
    expect(restored?.clientState.queries).toHaveLength(1);
    expect(restored?.clientState.queries[0].state.data).toEqual({ hello: 'world' });
  });

  it('discards stale cache older than 24 hours', async () => {
    const staleClient = makePersistedClient({
      timestamp: Date.now() - 1000 * 60 * 60 * 25,
    });
    mockStorage.getItem.mockResolvedValue(JSON.stringify(staleClient));

    const restored = await persister.restoreClient();
    expect(restored).toBeUndefined();
    expect(mockStorage.removeItem).toHaveBeenCalledWith('@skane_trails_query_cache');
  });

  it('keeps cache within 24 hours', async () => {
    const freshClient = makePersistedClient({
      timestamp: Date.now() - 1000 * 60 * 60 * 23,
    });
    mockStorage.getItem.mockResolvedValue(JSON.stringify(freshClient));

    const restored = await persister.restoreClient();
    expect(restored).toBeDefined();
  });

  it('removes client data', async () => {
    await persister.removeClient();
    expect(mockStorage.removeItem).toHaveBeenCalledWith('@skane_trails_query_cache');
  });

  it('returns undefined on restore error', async () => {
    mockStorage.getItem.mockRejectedValue(new Error('storage error'));
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  it('discards data with missing timestamp', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ clientState: { queries: [], mutations: [] } }));
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  it('discards data with non-finite timestamp', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ timestamp: NaN, clientState: { queries: [], mutations: [] } }));
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  it('discards corrupted JSON and removes key', async () => {
    mockStorage.getItem.mockResolvedValue('not valid json{{{');
    const result = await persister.restoreClient();
    expect(result).toBeUndefined();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  it('swallows persist error', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('disk full'));
    await expect(persister.persistClient(makePersistedClient())).resolves.toBeUndefined();
  });

  it('swallows remove error', async () => {
    mockStorage.removeItem.mockRejectedValue(new Error('storage error'));
    await expect(persister.removeClient()).resolves.toBeUndefined();
  });
});
