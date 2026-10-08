import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { pollSyncStatus } from '@/lib/sync/poll-sync-status';

export const SYNC_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Check what changed on the server: when mounted, when the app returns to the foreground,
 * and every few minutes while it is open. Mount once, for signed-in users only.
 */
export function useSyncPolling(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    void pollSyncStatus(queryClient);
    const timer = setInterval(() => void pollSyncStatus(queryClient), SYNC_POLL_INTERVAL);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pollSyncStatus(queryClient);
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, queryClient]);
}
