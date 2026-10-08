import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sync/poll-sync-status', () => ({
  pollSyncStatus: vi.fn().mockResolvedValue(undefined),
  claimLocalData: vi.fn().mockResolvedValue({ ownerUid: null, scope: null, seen: {} }),
}));

import { claimLocalData, pollSyncStatus } from '@/lib/sync/poll-sync-status';
import { SYNC_POLL_INTERVAL, useLocalDataReady, useSyncPolling } from '../use-sync-polling';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

describe('useSyncPolling', () => {
  const remove = vi.fn();
  let onChange: (state: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(AppState.addEventListener).mockImplementation(((_event: string, handler: never) => {
      onChange = handler;
      return { remove };
    }) as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls when mounted', () => {
    renderHook(() => useSyncPolling(), { wrapper });

    expect(pollSyncStatus).toHaveBeenCalledOnce();
  });

  it('polls every few minutes', () => {
    renderHook(() => useSyncPolling(), { wrapper });
    vi.mocked(pollSyncStatus).mockClear();

    vi.advanceTimersByTime(SYNC_POLL_INTERVAL * 2);

    expect(pollSyncStatus).toHaveBeenCalledTimes(2);
  });

  it('polls when the app returns to the foreground, not when it leaves', () => {
    renderHook(() => useSyncPolling(), { wrapper });
    vi.mocked(pollSyncStatus).mockClear();

    onChange('background');
    expect(pollSyncStatus).not.toHaveBeenCalled();

    onChange('active');
    expect(pollSyncStatus).toHaveBeenCalledOnce();
  });

  it('does nothing while disabled', () => {
    renderHook(() => useSyncPolling(false), { wrapper });
    vi.advanceTimersByTime(SYNC_POLL_INTERVAL);

    expect(pollSyncStatus).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('stops polling and listening when unmounted', () => {
    const { unmount } = renderHook(() => useSyncPolling(), { wrapper });
    vi.mocked(pollSyncStatus).mockClear();

    unmount();
    vi.advanceTimersByTime(SYNC_POLL_INTERVAL * 2);

    expect(pollSyncStatus).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe('useLocalDataReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(claimLocalData).mockResolvedValue({ ownerUid: null, scope: null, seen: {} });
  });

  it('is not ready while signed out, and checks nothing', () => {
    const { result } = renderHook(() => useLocalDataReady(undefined), { wrapper });

    expect(result.current).toBe(false);
    expect(claimLocalData).not.toHaveBeenCalled();
  });

  it('is not ready until the owner check is done', async () => {
    let finish: (value: never) => void = () => undefined;
    vi.mocked(claimLocalData).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const { result } = renderHook(() => useLocalDataReady('u1'), { wrapper });
    expect(result.current).toBe(false);

    finish(undefined as never);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is not ready for a new user until their check is done', async () => {
    let finish: (value: never) => void = () => undefined;
    const { result, rerender } = renderHook(({ uid }) => useLocalDataReady(uid), {
      wrapper,
      initialProps: { uid: 'u1' as string | undefined },
    });
    await waitFor(() => expect(result.current).toBe(true));

    vi.mocked(claimLocalData).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    rerender({ uid: 'u2' });
    expect(result.current).toBe(false);

    finish(undefined as never);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('goes on when the check fails, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimLocalData).mockRejectedValue(new Error('storage broken'));

    const { result } = renderHook(() => useLocalDataReady('u1'), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
