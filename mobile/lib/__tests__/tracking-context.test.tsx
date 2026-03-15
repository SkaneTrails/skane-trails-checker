import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { TrackingProvider, useTracking } from '@/lib/tracking-context';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      text: { primary: '#000', secondary: '#666', muted: '#999' },
      glass: { background: 'rgba(255,255,255,0.8)', border: 'rgba(0,0,0,0.1)' },
      primary: '#2E7D32',
    },
    shadows: { subtle: {}, elevated: {} },
  }),
  spacing: { sm: 8, md: 12, lg: 16 },
  borderRadius: { md: 8 },
  fontSize: { sm: 12, md: 14 },
  fontWeight: { semibold: '600', bold: '700' },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <TrackingProvider>{children}</TrackingProvider>;
}

describe('useTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    expect(result.current.status).toBe('idle');
    expect(result.current.points).toEqual([]);
    expect(result.current.stats).toBeNull();
  });

  it('transitions to tracking on start', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    expect(result.current.status).toBe('tracking');
  });

  it('transitions to paused on pause', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');
  });

  it('transitions back to tracking on resume', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => result.current.pause());
    act(() => result.current.resume());
    expect(result.current.status).toBe('tracking');
  });

  it('transitions to stopped on stop', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.status).toBe('stopped');
  });

  it('resets back to idle', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => {
      result.current.addPoint({ lat: 55, lng: 13, altitude: 100, timestamp: Date.now() });
    });
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.points).toEqual([]);
    expect(result.current.elapsedMs).toBe(0);
  });

  it('accumulates points', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => {
      result.current.addPoint({ lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 });
    });
    act(() => {
      result.current.addPoint({ lat: 55.001, lng: 13.0, altitude: 110, timestamp: 1700000060000 });
    });
    expect(result.current.points).toHaveLength(2);
  });

  it('computes stats with 2+ points', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => {
      result.current.addPoint({ lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 });
    });
    // Stats null with 1 point (EMPTY_STATS returned as fallback)
    act(() => {
      result.current.addPoint({ lat: 55.001, lng: 13.0, altitude: 110, timestamp: 1700000060000 });
    });
    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats!.distanceKm).toBeGreaterThan(0);
    expect(result.current.stats!.elevationGain).toBe(10);
    expect(result.current.stats!.pointCount).toBe(2);
  });

  it('updates elapsed time', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(3000);
  });

  it('pauses and resumes elapsed time correctly', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    const elapsedAtPause = result.current.elapsedMs;
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(5000)); // Time passes while paused
    expect(result.current.elapsedMs).toBe(elapsedAtPause); // Should not increase
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.elapsedMs).toBeGreaterThan(elapsedAtPause);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useTracking());
    }).toThrow('useTracking must be used within a TrackingProvider');
  });

  it('computes final stats on stop', () => {
    const { result } = renderHook(() => useTracking(), { wrapper });
    act(() => result.current.start());
    act(() => {
      result.current.addPoint({ lat: 55.0, lng: 13.0, altitude: 100, timestamp: 1700000000000 });
    });
    act(() => {
      result.current.addPoint({ lat: 55.01, lng: 13.0, altitude: 200, timestamp: 1700000120000 });
    });
    act(() => result.current.stop());
    expect(result.current.status).toBe('stopped');
    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats!.distanceKm).toBeGreaterThan(0);
  });
});
