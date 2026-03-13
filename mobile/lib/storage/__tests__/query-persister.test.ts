import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { createIdbPersister } from '../../storage/query-persister';

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

describe('createIdbPersister', () => {
  let persister: ReturnType<typeof createIdbPersister>;

  beforeEach(() => {
    persister = createIdbPersister();
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

    const restored = await persister.restoreClient();
    expect(restored).toBeDefined();
    expect(restored?.clientState.queries).toHaveLength(1);
    expect(restored?.clientState.queries[0].state.data).toEqual({ hello: 'world' });
  });

  it('discards stale cache older than 24 hours', async () => {
    const staleClient = makePersistedClient({
      timestamp: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago
    });
    await persister.persistClient(staleClient);

    const restored = await persister.restoreClient();
    expect(restored).toBeUndefined();
  });

  it('keeps cache within 24 hours', async () => {
    const freshClient = makePersistedClient({
      timestamp: Date.now() - 1000 * 60 * 60 * 23, // 23 hours ago
    });
    await persister.persistClient(freshClient);

    const restored = await persister.restoreClient();
    expect(restored).toBeDefined();
  });

  it('removes client data', async () => {
    const client = makePersistedClient();
    await persister.persistClient(client);
    await persister.removeClient();

    const restored = await persister.restoreClient();
    expect(restored).toBeUndefined();
  });

  it('overwrites previous persisted data', async () => {
    const client1 = makePersistedClient();
    await persister.persistClient(client1);

    const client2 = makePersistedClient({
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ['updated'],
            queryHash: '["updated"]',
            state: {
              data: { updated: true },
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
    });
    await persister.persistClient(client2);

    const restored = await persister.restoreClient();
    expect(restored?.clientState.queries[0].queryKey).toEqual(['updated']);
  });
});
