import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ syncApi: { getStatus: vi.fn() } }));
vi.mock('@/lib/auth-scope', () => ({ currentUserId: vi.fn(() => 'user-1') }));
vi.mock('@/lib/force-reload', () => ({ forceReload: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/map-trail-sync', () => ({ syncMapTrails: vi.fn() }));
vi.mock('@/lib/storage/sync-seen', () => ({
  syncSeen: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), clear: vi.fn() },
}));

import { syncApi } from '@/lib/api';
import { currentUserId } from '@/lib/auth-scope';
import { forceReload } from '@/lib/force-reload';
import { syncMapTrails } from '@/lib/map-trail-sync';
import { syncSeen } from '@/lib/storage/sync-seen';
import { claimLocalData, pollSyncStatus } from '../poll-sync-status';

const VERSIONS = {
  trails: 't1',
  places: 'p1',
  foraging_spots: 's1',
  foraging_types: 'f1',
  images: 'i1',
};

const status = (overrides: Record<string, string | null> = {}) => ({
  ...VERSIONS,
  ...overrides,
  scope: 'group:g1',
});

/** What was remembered after a sync: the versions, whose they are and their scope. */
const seenState = (
  seen: Record<string, string | null>,
  ownerUid: string | null = 'user-1',
  scope: string | null = 'group:g1',
) => ({ ownerUid, scope, seen });

const versionsOf = (overrides: Record<string, string | null> = {}) => ({ ...VERSIONS, ...overrides });

describe('claimLocalData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentUserId).mockReturnValue('user-1');
    queryClient = new QueryClient();
  });

  it('keeps the data of the same user', async () => {
    const state = seenState(versionsOf());
    vi.mocked(syncSeen.get).mockResolvedValue(state);

    expect(await claimLocalData(queryClient)).toBe(state);
    expect(forceReload).not.toHaveBeenCalled();
  });

  it('clears data of an unknown owner, since an older app version may have left it for someone else', async () => {
    vi.mocked(syncSeen.get).mockResolvedValue({ ownerUid: null, scope: null, seen: {} });

    const state = await claimLocalData(queryClient);

    expect(forceReload).toHaveBeenCalledWith(queryClient);
    expect(state).toEqual({ ownerUid: 'user-1', scope: null, seen: {} });
    expect(syncSeen.set).toHaveBeenCalledWith(state);
  });

  it('clears another user\'s data without asking the server, and takes over', async () => {
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf(), 'someone-else'));

    const state = await claimLocalData(queryClient);

    expect(syncApi.getStatus).not.toHaveBeenCalled();
    expect(forceReload).toHaveBeenCalledWith(queryClient);
    expect(state).toEqual({ ownerUid: 'user-1', scope: null, seen: {} });
    expect(syncSeen.set).toHaveBeenCalledWith(state);
  });
});

describe('pollSyncStatus', () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentUserId).mockReturnValue('user-1');
    queryClient = new QueryClient();
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    vi.mocked(syncMapTrails).mockResolvedValue([]);
  });

  it('does nothing but ask when nothing changed', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(invalidate).not.toHaveBeenCalled();
    expect(syncMapTrails).not.toHaveBeenCalled();
    expect(syncSeen.set).not.toHaveBeenCalled();
  });

  it('refetches only the data type that changed and remembers its version', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ places: 'p2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: ['places'], refetchType: 'active' },
      { throwOnError: true },
    );
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf({ places: 'p2' })));
  });

  it.each([
    ['foraging_spots', ['foraging', 'spots']],
    ['foraging_types', ['foraging', 'types']],
    ['images', ['trails', 'image-pins']],
  ])('maps a %s change to its query', async (kind, queryKey) => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ [kind]: 'new' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(invalidate).toHaveBeenCalledWith(
      { queryKey, refetchType: 'active' },
      { throwOnError: true },
    );
  });

  it('syncs trails strictly, shows the result and refreshes open trail screens', async () => {
    const trails = [{ trail_id: 'a' }] as never;
    vi.mocked(syncMapTrails).mockResolvedValue(trails);
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ trails: 't2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(syncMapTrails).toHaveBeenCalledWith(expect.any(Function), { strict: true });
    expect(queryClient.getQueryData(['trails', 'map'])).toBe(trails);
    // Not thrown on: the screen of a trail deleted elsewhere fails to refetch, which is expected.
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['trails', 'detail'],
      refetchType: 'active',
    });
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf({ trails: 't2' })));
  });

  it('does not remember the trails version when the trail sync failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncMapTrails).mockRejectedValue(new Error('offline'));
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ trails: 't2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(queryClient.getQueryData(['trails', 'map'])).toBeUndefined();
    expect(syncSeen.set).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refetches everything on the first poll', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue({ ownerUid: null, scope: null, seen: {} });

    await pollSyncStatus(queryClient);

    expect(syncMapTrails).toHaveBeenCalledOnce();
    // Four kinds plus the open trail screens
    expect(invalidate).toHaveBeenCalledTimes(5);
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf()));
  });

  it('treats a data type that was never written as unchanged', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ places: null }));
    // places absent from the remembered versions entirely
    vi.mocked(syncSeen.get).mockResolvedValue(
      seenState({ trails: 't1', foraging_spots: 's1', foraging_types: 'f1', images: 'i1' }),
    );

    await pollSyncStatus(queryClient);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('retries a failed refetch at the next poll by not remembering its version', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ foraging_spots: 's2', places: 'p2' }));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));
    invalidate.mockImplementation(async (filters: unknown) => {
      if ((filters as { queryKey: unknown[] }).queryKey[0] === 'foraging') {
        throw new Error('offline');
      }
    });

    await pollSyncStatus(queryClient);

    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf({ places: 'p2' })));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("wipes the previous user's local data when someone else signed in", async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf(), 'someone-else'));

    await pollSyncStatus(queryClient);

    expect(forceReload).toHaveBeenCalledWith(queryClient);
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf()));
  });

  it('wipes the previous user\'s data before asking the server, so being offline cannot leave it behind', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockRejectedValue(new Error('offline'));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf(), 'someone-else'));

    await pollSyncStatus(queryClient);

    expect(forceReload).toHaveBeenCalledWith(queryClient);
    // The new owner is recorded with nothing seen, so a later poll refetches everything.
    expect(syncSeen.set).toHaveBeenCalledWith({ ownerUid: 'user-1', scope: null, seen: {} });
    warn.mockRestore();
  });

  it('wipes local data when the same user now has a different scope', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue({ ...status(), scope: 'group:other' });
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await pollSyncStatus(queryClient);

    expect(forceReload).toHaveBeenCalledWith(queryClient);
    expect(syncSeen.set).toHaveBeenCalledWith(seenState(versionsOf(), 'user-1', 'group:other'));
  });

  it('remembers a scope change even when the refetch afterwards fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockResolvedValue({ ...status(), scope: 'group:other' });
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));
    vi.mocked(syncMapTrails).mockRejectedValue(new Error('offline'));

    await pollSyncStatus(queryClient);

    expect(forceReload).toHaveBeenCalledOnce();
    const saved = vi.mocked(syncSeen.set).mock.calls.at(-1)?.[0];
    expect(saved?.scope).toBe('group:other');
    expect(saved?.seen.trails).toBeUndefined();
    warn.mockRestore();
  });

  it('never throws when the server cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(syncApi.getStatus).mockRejectedValue(new Error('offline'));
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await expect(pollSyncStatus(queryClient)).resolves.toBeUndefined();

    expect(forceReload).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shares one poll between simultaneous callers', async () => {
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    await Promise.all([pollSyncStatus(queryClient), pollSyncStatus(queryClient)]);

    expect(syncApi.getStatus).toHaveBeenCalledOnce();
  });

  it('does not let a new user join the poll of the previous one', async () => {
    let answer: (value: ReturnType<typeof status>) => void = () => undefined;
    vi.mocked(syncApi.getStatus).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    vi.mocked(syncApi.getStatus).mockResolvedValue(status());
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));

    const first = pollSyncStatus(queryClient);
    vi.mocked(currentUserId).mockReturnValue('user-2');
    const second = pollSyncStatus(queryClient);
    answer(status());
    await Promise.all([first, second]);

    expect(syncApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('discards the result of a poll when another user signed in meanwhile', async () => {
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));
    vi.mocked(syncApi.getStatus).mockImplementation(async () => {
      vi.mocked(currentUserId).mockReturnValue('user-2');
      return status({ places: 'p2', trails: 't2' });
    });

    await pollSyncStatus(queryClient);

    expect(invalidate).not.toHaveBeenCalled();
    expect(syncMapTrails).not.toHaveBeenCalled();
    expect(syncSeen.set).not.toHaveBeenCalled();
  });

  it("does not show the previous user's trails or remember their versions when they sign out mid-refresh", async () => {
    vi.mocked(syncSeen.get).mockResolvedValue(seenState(versionsOf()));
    vi.mocked(syncApi.getStatus).mockResolvedValue(status({ trails: 't2' }));
    vi.mocked(syncMapTrails).mockImplementation(async () => {
      vi.mocked(currentUserId).mockReturnValue('user-2');
      return [{ trail_id: 'private' }] as never;
    });

    await pollSyncStatus(queryClient);

    expect(queryClient.getQueryData(['trails', 'map'])).toBeUndefined();
    expect(syncSeen.set).not.toHaveBeenCalled();
  });
});
