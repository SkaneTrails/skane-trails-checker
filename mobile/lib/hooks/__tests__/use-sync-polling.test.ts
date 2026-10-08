import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sync/poll-sync-status', () => ({
  pollSyncStatus: vi.fn().mockResolvedValue(undefined),
}));

import { pollSyncStatus } from '@/lib/sync/poll-sync-status';
import { SYNC_POLL_INTERVAL, useSyncPolling } from '../use-sync-polling';

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
