import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-location
vi.mock('expo-location', () => ({
  startLocationUpdatesAsync: vi.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: vi.fn(() => Promise.resolve()),
  Accuracy: { High: 5 },
  ActivityType: { Fitness: 3 },
}));

// Mock expo-task-manager
const taskCallbacks = new Map<string, (body: { data: unknown; error: unknown }) => void>();
vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn((name: string, cb: (body: { data: unknown; error: unknown }) => void) => {
    taskCallbacks.set(name, cb);
  }),
  isTaskDefined: vi.fn(() => false),
  isTaskRegisteredAsync: vi.fn(() => Promise.resolve(false)),
}));

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Must import AFTER mocks are set up
let TrackingService: typeof import('@/lib/tracking-service');

describe('tracking-service', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    taskCallbacks.clear();
    // clearAllMocks doesn't reset mockReturnValue — ensure defineTask runs on import
    vi.mocked(TaskManager.isTaskDefined).mockReturnValue(false);
    // Clear globalThis tracking state (shared across Fast Refresh reloads)
    delete (globalThis as Record<string, unknown>)['__skane_tracking_state__'];
    // Re-import to reset module-level state
    vi.resetModules();
    TrackingService = await import('@/lib/tracking-service');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('guards defineTask against duplicate registration', async () => {
    expect(TaskManager.isTaskDefined).toHaveBeenCalledWith('background-location-tracking');
    expect(TaskManager.defineTask).toHaveBeenCalledTimes(1);

    // Second import with task already defined
    vi.mocked(TaskManager.isTaskDefined).mockReturnValue(true);
    vi.mocked(TaskManager.defineTask).mockClear();
    vi.resetModules();
    await import('@/lib/tracking-service');
    expect(TaskManager.defineTask).not.toHaveBeenCalled();
  });

  it('startTracking starts location updates', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'background-location-tracking',
      expect.objectContaining({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      }),
    );
  });

  it('startTracking clears persisted buffer to prevent stale recovery', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@skane_trails_tracking_buffer');
  });

  it('startTracking invokes listener when task receives locations', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    const taskCb = taskCallbacks.get('background-location-tracking');
    expect(taskCb).toBeDefined();

    taskCb!({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    expect(onPoint).toHaveBeenCalledWith({
      lat: 55.6,
      lng: 13.0,
      altitude: 100,
      timestamp: 1000,
    });
  });

  it('task callback ignores errors', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    const taskCb = taskCallbacks.get('background-location-tracking');
    taskCb!({ data: {}, error: 'some error' });

    expect(onPoint).not.toHaveBeenCalled();
  });

  it('flushes buffer to AsyncStorage periodically', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    // Simulate a location update
    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    // Advance past flush interval
    await vi.advanceTimersByTimeAsync(30_000);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@skane_trails_tracking_buffer',
      expect.any(String),
    );

    const storedData = JSON.parse(
      vi.mocked(AsyncStorage.setItem).mock.calls[0][1],
    );
    expect(storedData).toEqual([{ lat: 55.6, lng: 13.0, altitude: 100, timestamp: 1000 }]);
  });

  it('pauseTracking stops updates but preserves buffer', async () => {
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);
    // startTracking clears persisted buffer — reset mock for pause assertions
    vi.mocked(AsyncStorage.removeItem).mockClear();

    // Add a point
    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    await TrackingService.pauseTracking();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith('background-location-tracking');
    // Buffer is flushed to storage, not removed
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@skane_trails_tracking_buffer',
      expect.any(String),
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('stopTracking clears buffer and returns points', async () => {
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    const points = await TrackingService.stopTracking();

    expect(points).toEqual([{ lat: 55.6, lng: 13.0, altitude: 100, timestamp: 1000 }]);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@skane_trails_tracking_buffer');
  });

  it('stopTracking handles case when task is not registered', async () => {
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
    const points = await TrackingService.stopTracking();
    expect(points).toEqual([]);
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('isTracking delegates to TaskManager', async () => {
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    const result = await TrackingService.isTracking();
    expect(result).toBe(true);
  });

  it('recoverPoints reads from AsyncStorage without clearing', async () => {
    const stored = JSON.stringify([{ lat: 55.6, lng: 13.0, altitude: 100, timestamp: 1000 }]);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(stored);

    const points = await TrackingService.recoverPoints();

    expect(points).toEqual([{ lat: 55.6, lng: 13.0, altitude: 100, timestamp: 1000 }]);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('recoverPoints returns empty array when no buffer exists', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    const points = await TrackingService.recoverPoints();
    expect(points).toEqual([]);
  });

  it('recoverPoints self-heals on corrupted data', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('not valid json{{{');

    const points = await TrackingService.recoverPoints();

    expect(points).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@skane_trails_tracking_buffer');
  });

  it('pauseTracking continues even if flush fails', async () => {
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    // Should not throw
    await TrackingService.pauseTracking();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('clearBuffer removes persisted data', async () => {
    await TrackingService.clearBuffer();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@skane_trails_tracking_buffer');
  });

  it('clearBuffer swallows errors without throwing', async () => {
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk full'));
    await expect(TrackingService.clearBuffer()).resolves.toBeUndefined();
  });

  it('resumeTracking preserves buffer and restarts GPS', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    // Add a point
    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    // Pause
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    await TrackingService.pauseTracking();
    vi.mocked(Location.startLocationUpdatesAsync).mockClear();

    // Resume — buffer should NOT be cleared
    const onPoint2 = vi.fn();
    await TrackingService.resumeTracking(onPoint2);

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'background-location-tracking',
      expect.objectContaining({ accuracy: Location.Accuracy.High }),
    );

    // Simulate another point after resume
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.7, longitude: 13.1, altitude: 110 }, timestamp: 2000 },
        ],
      },
      error: null,
    });

    expect(onPoint2).toHaveBeenCalledWith({
      lat: 55.7,
      lng: 13.1,
      altitude: 110,
      timestamp: 2000,
    });

    // Stop should return all points (both before and after resume)
    vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
    const points = await TrackingService.stopTracking();
    expect(points).toHaveLength(2);
    expect(points[0].lat).toBe(55.6);
    expect(points[1].lat).toBe(55.7);
  });

  it('flush timer swallows AsyncStorage errors', async () => {
    const onPoint = vi.fn();
    await TrackingService.startTracking(onPoint);

    const taskCb = taskCallbacks.get('background-location-tracking')!;
    taskCb({
      data: {
        locations: [
          { coords: { latitude: 55.6, longitude: 13.0, altitude: 100 }, timestamp: 1000 },
        ],
      },
      error: null,
    });

    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    // Should not throw
    await vi.advanceTimersByTimeAsync(30_000);

    // Verify setItem was called (and rejected gracefully)
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
