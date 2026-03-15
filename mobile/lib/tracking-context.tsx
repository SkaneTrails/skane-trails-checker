/**
 * Tracking context — manages GPS recording lifecycle.
 *
 * State machine: idle → tracking → paused → tracking → stopped → idle
 * Platform-agnostic: holds coordinate buffer, timer, stats.
 * Actual GPS provider is injected via addPoint() from native code.
 */

import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { TrackingPoint, TrackingStats } from '@/lib/track-to-trail';
import { computeTrackingStats } from '@/lib/track-to-trail';

export type TrackingStatus = 'idle' | 'tracking' | 'paused' | 'stopped';

interface TrackingContextType {
  status: TrackingStatus;
  points: TrackingPoint[];
  stats: TrackingStats | null;
  elapsedMs: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  addPoint: (point: TrackingPoint) => void;
}

const TrackingContext = createContext<TrackingContextType | null>(null);

const EMPTY_STATS: TrackingStats = {
  distanceKm: 0,
  elevationGain: 0,
  elevationLoss: 0,
  durationMinutes: 0,
  pointCount: 0,
  bounds: { north: 0, south: 0, east: 0, west: 0 },
  center: { lat: 0, lng: 0 },
};

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(pausedElapsedRef.current + (Date.now() - startTimeRef.current));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setStatus('tracking');
    setPoints([]);
    setStats(null);
    setElapsedMs(0);
    pausedElapsedRef.current = 0;
    startTimer();
  }, [startTimer]);

  const pause = useCallback(() => {
    setStatus('paused');
    pausedElapsedRef.current += Date.now() - startTimeRef.current;
    stopTimer();
  }, [stopTimer]);

  const resume = useCallback(() => {
    setStatus('tracking');
    startTimer();
  }, [startTimer]);

  const stop = useCallback(() => {
    setStatus('stopped');
    stopTimer();
    setPoints((current) => {
      if (current.length >= 2) {
        setStats(computeTrackingStats(current));
      }
      return current;
    });
  }, [stopTimer]);

  const reset = useCallback(() => {
    setStatus('idle');
    setPoints([]);
    setStats(null);
    setElapsedMs(0);
    pausedElapsedRef.current = 0;
    stopTimer();
  }, [stopTimer]);

  const addPoint = useCallback((point: TrackingPoint) => {
    setPoints((prev) => {
      const updated = [...prev, point];
      if (updated.length >= 2) {
        setStats(computeTrackingStats(updated));
      }
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      status,
      points,
      stats: stats ?? (points.length > 0 ? EMPTY_STATS : null),
      elapsedMs,
      start,
      pause,
      resume,
      stop,
      reset,
      addPoint,
    }),
    [status, points, stats, elapsedMs, start, pause, resume, stop, reset, addPoint],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking(): TrackingContextType {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}
