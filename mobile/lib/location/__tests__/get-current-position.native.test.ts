import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  Accuracy: { High: 5 },
}));

describe('getCurrentPosition (native adapter)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns { lat, lng } on success', async () => {
    const ExpoLocation = await import('expo-location');
    vi.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    } as never);
    vi.mocked(ExpoLocation.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 55.6, longitude: 13.0, altitude: null, accuracy: 10, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now(),
    } as never);

    const { getCurrentPosition } = await import('../get-current-position.native');
    const result = await getCurrentPosition();

    expect(result).toEqual({ lat: 55.6, lng: 13.0 });
  });

  it('throws LocationError with reason "permission_denied" when denied', async () => {
    const ExpoLocation = await import('expo-location');
    vi.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
      granted: false,
      expires: 'never',
      canAskAgain: true,
    } as never);

    const { getCurrentPosition } = await import('../get-current-position.native');

    await expect(getCurrentPosition()).rejects.toMatchObject({
      name: 'LocationError',
      reason: 'permission_denied',
    });
  });

  it('throws LocationError with reason "unknown" when getCurrentPositionAsync fails', async () => {
    const ExpoLocation = await import('expo-location');
    vi.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    } as never);
    vi.mocked(ExpoLocation.getCurrentPositionAsync).mockRejectedValue(
      new Error('GPS unavailable'),
    );

    const { getCurrentPosition } = await import('../get-current-position.native');

    await expect(getCurrentPosition()).rejects.toMatchObject({
      name: 'LocationError',
      reason: 'unknown',
    });
  });

  it('requests high accuracy', async () => {
    const ExpoLocation = await import('expo-location');
    vi.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
      granted: true,
      expires: 'never',
      canAskAgain: true,
    } as never);
    vi.mocked(ExpoLocation.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 1, longitude: 2, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now(),
    } as never);

    const { getCurrentPosition } = await import('../get-current-position.native');
    await getCurrentPosition();

    expect(ExpoLocation.getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 5 }), // Accuracy.High = 5
    );
  });
});
