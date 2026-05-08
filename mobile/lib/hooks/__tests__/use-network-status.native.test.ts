import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type NetInfoCallback = (state: { isConnected: boolean | null }) => void;
let capturedCallback: NetInfoCallback | null = null;
const unsubscribe = vi.fn();

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: (cb: NetInfoCallback) => {
      capturedCallback = cb;
      return unsubscribe;
    },
  },
}));

import { useNetworkStatus } from '../use-network-status.native';

describe('useNetworkStatus (native)', () => {
  it('defaults to online', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('updates when NetInfo reports disconnected', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      capturedCallback?.({ isConnected: false });
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('treats null isConnected as online', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      capturedCallback?.({ isConnected: null });
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
