import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ syncApi: { getStatus: vi.fn() } }));
vi.mock('@/lib/auth-scope', () => ({ currentUserId: vi.fn(() => 'user-1') }));
vi.mock('@/lib/force-reload', () => ({ forceReload: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/storage/sync-seen', () => ({
  syncSeen: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), clear: vi.fn() },
}));

import { syncApi } from '@/lib/api';
import { forceReload } from '@/lib/force-reload';
import { syncSeen } from '@/lib/storage/sync-seen';
import { pollSyncStatus } from '../poll-sync-status';

const status = (overrides: Record<string, string | null> = {}) => ({
  trails: 't1',
  places: 'p1',
  foraging_spots: 's1',
  foraging_types: 'f1',
  images: 'i1',
  ...overrides,
});

const seenState = (seen: Record<string, string | null>, ownerUid: string | null = 'user-1') => ({
  ownerUid,
  seen,
});

describe('pollSyncStatus', () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  });

  it('does nothing but ask when nothing changed', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status()));

    await pollSyncStatus(queryClient);

    expect(invalidate).not.toHaveBeenCalled();
    expect(syncSeen.set).not.toHaveBeenCalled();
  });

  it('refetches only the data type that changed and remembers its version', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ places: 'p2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status()));

    await pollSyncStatus(queryClient);

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: ['places'], refetchType: 'active' },
      { throwOnError: true },
    );
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(status({ places: 'p2' })));
  });

  it.each([
    ['trails', ['trails', 'map']],
    ['foraging_spots', ['foraging', 'spots']],
    ['foraging_types', ['foraging', 'types']],
    ['images', ['trails', 'image-pins']],
  ])('maps a %s change to its query', async (kind, queryKey) => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ [kind]: 'new' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status()));

    await pollSyncStatus(queryClient);

    expect(invalidate).toHaveBeenCalledWith(
      { queryKey, refetchType: 'active' },
      { throwOnError: true },
    );
  });

  it('refetches everything on the first poll', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue({ ownerUid: null, seen: {} });

    await pollSyncStatus(queryClient);

    expect(invalidate).toHaveBeenCalledTimes(5);
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(status()));
  });

  it('treats a data type that was never written as unchanged', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ places: null }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status({ places: null })));
    // places absent from the remembered versions entirely
    vi.mocked(syncSeen.get).mockResolvedValue(
      seenState({ trails: 't1', foraging_spots: 's1', foraging_types: 'f1', images: 'i1' }),
    );

    await pollSyncStatus(queryClient);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('retries a failed refetch at the next poll by not remembering its version', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ trails: 't2', places: 'p2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status()));
    invalidate.mockImplementation(async (filters: unknown) => {
      if ((filters as { queryKey: unknown[] }).queryKey[0] === 'trails') {
        throw new Error('offline');
      }
    });

    await pollSyncStatus(queryClient);

    expect(syncSeen.set).toHaveBeenCalledWith(seenState(status({ places: 'p2' })));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("wipes the previous user's local data when someone else signed in", async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status(), 'someone-else'));

    await pollSyncStatus(queryClient);

    expect(forceReload).toHaveBeenCalledWith(queryClient);
    expect(invalidate).not.toHaveBeenCalled();
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(status()));
  });

  it('never throws when the server cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockRejectedValue(new Error('offline'));

    await expect(pollSyncStatus(queryClient)).resolves.toBeUndefined();

    expect(syncSeen.get).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shares one poll between simultaneous callers', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(status()));

    await Promise.all([pollSyncStatus(queryClient), pollSyncStatus(queryClient)]);

    expect(syncApi.getStatus).toHaveBeenCalledOnce();
  });
});
