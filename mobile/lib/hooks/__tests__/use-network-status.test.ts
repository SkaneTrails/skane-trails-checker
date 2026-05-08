import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNetworkStatus } from '../use-network-status';

describe('useNetworkStatus (web)', () => {
  let listeners: Record<string, Set<() => void>>;

  beforeEach(() => {
    listeners = { online: new Set(), offline: new Set() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      listeners[event]?.add(cb as () => void);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, cb) => {
      listeners[event]?.delete(cb as () => void);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('updates when going offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      listeners.offline.forEach((cb) => cb());
    });

    expect(result.current.isOnline).toBe(false);
  });
});
