/**
 * Background GPS tracking service using expo-location + expo-task-manager.
 *
 * Registers a background task that receives location updates even when
 * the screen is off. Coordinates are buffered in memory and periodically
 * flushed to AsyncStorage for crash recovery.
 *
 * Buffer lifecycle:
 * - startTracking: clears buffer, starts a new recording
 * - resumeTracking: preserves buffer, restarts GPS after pause
 * - pauseTracking: stops GPS updates but preserves buffer
 * - stopTracking: stops GPS updates AND clears buffer (use after save/discard)
 * - recoverPoints: reads crash-recovery buffer (does NOT clear it)
 * - clearBuffer: explicitly clears persisted buffer
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { GpsMode } from '@/lib/settings-context';

const TRACKING_TASK = 'background-location-tracking';
const STORAGE_KEY = '@skane_trails_tracking_buffer';
const FLUSH_INTERVAL_MS = 30_000;

/**
 * GPS configuration per mode.
 * - balanced: 10s/10m intervals, Balanced accuracy, pauses when stationary
 *   Good for hiking (walking ~4-5 km/h = ~12m per 10s), saves 50-70% battery
 * - high_precision: 3s/5m intervals, High accuracy, always on
 *   For detailed tracks where battery is not a concern
 */
const GPS_CONFIG: Record<GpsMode, {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  pausesUpdatesAutomatically: boolean;
}> = {
  balanced: {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10_000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: true,
  },
  high_precision: {
    accuracy: Location.Accuracy.High,
    timeInterval: 3_000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
  },
};

type PointListener = (point: TrackingPoint) => void;

// Use globalThis to ensure the task callback and exported functions share
// the same state across Fast Refresh reloads (the defineTask guard means
// the old callback survives, so it must reference the same objects).
const STATE_KEY = '__skane_tracking_state__' as const;

interface TrackingState {
  pointListener: PointListener | null;
  flushTimer: ReturnType<typeof setInterval> | null;
  memoryBuffer: TrackingPoint[];
}

function getState(): TrackingState {
  if (!(globalThis as Record<string, unknown>)[STATE_KEY]) {
    (globalThis as Record<string, unknown>)[STATE_KEY] = {
      pointListener: null,
      flushTimer: null,
      memoryBuffer: [],
    };
  }
  return (globalThis as Record<string, unknown>)[STATE_KEY] as TrackingState;
}

/**
 * Register the background task. Must be called at module scope
 * (outside of any component) for expo-task-manager to work.
 * Guarded to avoid duplicate registration on Fast Refresh.
 */
if (!TaskManager.isTaskDefined(TRACKING_TASK)) {
  TaskManager.defineTask(TRACKING_TASK, async ({ data, error }) => {
    if (error) return;

    const locations = (data as { locations?: Location.LocationObject[] })?.locations;
    if (!locations) return;
    const state = getState();
    for (const loc of locations) {
      const point: TrackingPoint = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        altitude: loc.coords.altitude,
        timestamp: loc.timestamp,
      };

      state.memoryBuffer.push(point);
      state.pointListener?.(point);
    }
  });
}

function startFlushTimer() {
  stopFlushTimer();
  const state = getState();
  state.flushTimer = setInterval(async () => {
    if (state.memoryBuffer.length > 0) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.memoryBuffer));
      } catch {
        // Swallow write errors — crash recovery is best-effort
      }
    }
  }, FLUSH_INTERVAL_MS);
}

function stopFlushTimer() {
  const state = getState();
  if (state.flushTimer) {
    clearInterval(state.flushTimer);
    state.flushTimer = null;
  }
}

/**
 * Start background location tracking.
 * Requires foreground + background permissions to be granted first.
 */
export async function startTracking(onPoint: PointListener, gpsMode: GpsMode = 'balanced'): Promise<void> {
  const state = getState();
  state.memoryBuffer = [];
  state.pointListener = onPoint;

  // Clear persisted buffer so crash recovery doesn't return stale data
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});

  // Defensive fallback if gpsMode is corrupted/invalid
  const config = GPS_CONFIG[gpsMode] ?? GPS_CONFIG.balanced;
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: config.accuracy,
    timeInterval: config.timeInterval,
    distanceInterval: config.distanceInterval,
    foregroundService: {
      notificationTitle: 'Recording hike',
      notificationBody: 'GPS tracking active',
      notificationColor: '#1a5e2a',
    },
    pausesUpdatesAutomatically: config.pausesUpdatesAutomatically,
    activityType: Location.ActivityType.Fitness,
  });

  startFlushTimer();
}

/**
 * Resume tracking after a pause — restarts GPS without clearing the buffer.
 * Preserves crash-recovery data accumulated before the pause.
 */
export async function resumeTracking(onPoint: PointListener, gpsMode: GpsMode = 'balanced'): Promise<void> {
  const state = getState();
  state.pointListener = onPoint;

  // Defensive fallback if gpsMode is corrupted/invalid
  const config = GPS_CONFIG[gpsMode] ?? GPS_CONFIG.balanced;
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: config.accuracy,
    timeInterval: config.timeInterval,
    distanceInterval: config.distanceInterval,
    foregroundService: {
      notificationTitle: 'Recording hike',
      notificationBody: 'GPS tracking active',
      notificationColor: '#1a5e2a',
    },
    pausesUpdatesAutomatically: config.pausesUpdatesAutomatically,
    activityType: Location.ActivityType.Fitness,
  });

  startFlushTimer();
}

/**
 * Pause GPS tracking — stops location updates but preserves the buffer.
 * Use this when pausing or stopping recording (before the user saves/discards).
 */
export async function pauseTracking(): Promise<void> {
  stopFlushTimer();

  const state = getState();

  // Flush current buffer to storage before pausing (best-effort)
  if (state.memoryBuffer.length > 0) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.memoryBuffer));
    } catch {
      // Best-effort flush — don't break pause/stop flow
    }
  }

  const registered = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK);
  if (registered) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }

  state.pointListener = null;
}

/**
 * Stop tracking and clear all buffers.
 * Call this only after the recording has been saved or discarded.
 */
export async function stopTracking(): Promise<TrackingPoint[]> {
  stopFlushTimer();

  const registered = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK);
  if (registered) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }

  const state = getState();
  const points = [...state.memoryBuffer];
  state.memoryBuffer = [];
  state.pointListener = null;

  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort cleanup — don't break stop flow
  }

  return points;
}

/**
 * Clear the persisted crash-recovery buffer.
 * Call after a successful save or explicit discard.
 */
export async function clearBuffer(): Promise<void> {
  const state = getState();
  state.memoryBuffer = [];
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort — don't crash callers
  }
}

/**
 * Check if background tracking is currently active.
 */
export async function isTracking(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(TRACKING_TASK);
}

/**
 * Recover coordinates from AsyncStorage after a crash.
 * Returns the buffered points or an empty array if none exist.
 * Does NOT clear the buffer — call clearBuffer() after successful save.
 */
export async function recoverPoints(): Promise<TrackingPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrackingPoint[];
  } catch {
    // Corrupted buffer — self-heal by clearing
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    return [];
  }
}
