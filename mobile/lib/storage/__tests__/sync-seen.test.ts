import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSeen } from '../sync-seen';

const storage = vi.mocked(AsyncStorage);

describe('syncSeen', () => {
  beforeEach(() => {
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.removeItem.mockReset();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
  });

  it('has seen nothing before the first sync', async () => {
    expect(await syncSeen.get()).toEqual({ ownerUid: null, scope: null, seen: {} });
  });

  it('remembers the owner, scope and versions', async () => {
    const state = { ownerUid: 'u1', scope: 'group:g1', seen: { trails: 'v1', places: null } };
    storage.getItem.mockResolvedValue(JSON.stringify(state));

    expect(await syncSeen.get()).toEqual(state);
  });

  it('stores the state as one entry', async () => {
    await syncSeen.set({ ownerUid: 'u1', scope: 'all', seen: { trails: 'v1' } });

    expect(storage.setItem).toHaveBeenCalledWith(
      '@sync_seen',
      JSON.stringify({ ownerUid: 'u1', scope: 'all', seen: { trails: 'v1' } }),
    );
  });

  it('treats an unreadable entry as nothing seen', async () => {
    storage.getItem.mockResolvedValue('{not json');

    expect(await syncSeen.get()).toEqual({ ownerUid: null, scope: null, seen: {} });
  });

  it('treats a failing read as nothing seen', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    expect(await syncSeen.get()).toEqual({ ownerUid: null, scope: null, seen: {} });
  });

  it('does not throw when writing or clearing fails', async () => {
    storage.setItem.mockRejectedValue(new Error('full'));
    storage.removeItem.mockRejectedValue(new Error('locked'));

    await expect(syncSeen.set({ ownerUid: 'u1', scope: null, seen: {} })).resolves.toBeUndefined();
    await expect(syncSeen.clear()).resolves.toBeUndefined();
  });

  it('clear removes the entry', async () => {
    await syncSeen.clear();

    expect(storage.removeItem).toHaveBeenCalledWith('@sync_seen');
  });
});
