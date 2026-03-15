/**
 * Background GPS tracking service using expo-location + expo-task-manager.
 *
 * Registers a background task that receives location updates even when
 * the screen is off. Coordinates are buffered in memory and periodically
 * flushed to AsyncStorage for crash recovery.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackingPoint } from '@/lib/track-to-trail';

const TRACKING_TASK = 'background-location-tracking';
const STORAGE_KEY = 'tracking-buffer';
const FLUSH_INTERVAL_MS = 30_000;

type PointListener = (point: TrackingPoint) => void;

let pointListener: PointListener | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let memoryBuffer: TrackingPoint[] = [];

/**
 * Register the background task. Must be called at module scope
 * (outside of any component) for expo-task-manager to work.
 */
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
 * Stop background location tracking.
 * Returns all recorded coordinates and clears the storage buffer.
 */
export async function stopTracking(): Promise<TrackingPoint[]> {
  stopFlushTimer();

  const isTracking = await TaskManager.isTaskRegisteredAsync(TRACKING_TASK);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }

  const points = [...memoryBuffer];
  memoryBuffer = [];
  pointListener = null;

  await AsyncStorage.removeItem(STORAGE_KEY);

  return points;
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
 */
export async function recoverPoints(): Promise<TrackingPoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  await AsyncStorage.removeItem(STORAGE_KEY);
  return JSON.parse(raw) as TrackingPoint[];
}
