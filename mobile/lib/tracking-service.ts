/**
 * Background GPS tracking service using expo-location + expo-task-manager.
 *
 * Registers a background task that receives location updates even when
 * the screen is off. Coordinates are buffered in memory and periodically
 * flushed to AsyncStorage for crash recovery.
 *
 * Buffer lifecycle:
 * - startTracking: clears buffer, starts collecting
 * - pauseTracking: stops GPS updates but preserves buffer
 * - stopTracking: stops GPS updates AND clears buffer (use after save/discard)
 * - recoverPoints: reads crash-recovery buffer (does NOT clear it)
 * - clearBuffer: explicitly clears persisted buffer
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackingPoint } from '@/lib/track-to-trail';

const TRACKING_TASK = 'background-location-tracking';
const STORAGE_KEY = '@skane_trails_tracking_buffer';
const FLUSH_INTERVAL_MS = 30_000;

type PointListener = (point: TrackingPoint) => void;

let pointListener: PointListener | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let memoryBuffer: TrackingPoint[] = [];

/**
 * Register the background task. Must be called at module scope
 * (outside of any component) for expo-task-manager to work.
 * Guarded to avoid duplicate registration on Fast Refresh.
 */
if (!TaskManager.isTaskDefined(TRACKING_TASK)) {
  TaskManager.defineTask(TRACKING_TASK, ({ data, error }) => {
    if (error) return;

    const locations = (data as { locations?: Location.LocationObject[] })?.locations;
    if (!locations) return;

    for (const loc of locations) {
      const point: TrackingPoint = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        altitude: loc.coords.altitude,
        timestamp: loc.timestamp,
      };

      memoryBuffer.push(point);
      pointListener?.(point);
    }
  });
}

function startFlushTimer() {
  stopFlushTimer();
  flushTimer = setInterval(async () => {
    if (memoryBuffer.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryBuffer));
    }
  }, FLUSH_INTERVAL_MS);
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Start background location tracking.
 * Requires foreground + background permissions to be granted first.
 */
export async function startTracking(onPoint: PointListener): Promise<void> {
  memoryBuffer = [];
  pointListener = onPoint;

  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: 'Recording hike',
      notificationBody: 'GPS tracking active',
      notificationColor: '#1a5e2a',
    },
    pausesUpdatesAutomatically: false,
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

  // Flush current buffer to storage before pausing
  if (memoryBuffer.length > 0) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryBuffer));
  }

  const registered = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK);
  if (registered) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }

  pointListener = null;
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

  const points = [...memoryBuffer];
  memoryBuffer = [];
  pointListener = null;

  await AsyncStorage.removeItem(STORAGE_KEY);

  return points;
}

/**
 * Clear the persisted crash-recovery buffer.
 * Call after a successful save or explicit discard.
 */
export async function clearBuffer(): Promise<void> {
  memoryBuffer = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
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
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  return JSON.parse(raw) as TrackingPoint[];
}
