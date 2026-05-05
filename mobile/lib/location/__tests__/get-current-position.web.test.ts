import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationError } from '../types';

/**
 * Shared contract tests for getCurrentPosition.
 *
 * Both web and native implementations must pass these tests.
 * The test file mocks the underlying platform API and verifies
 * the adapter returns a consistent Coords shape or throws LocationError.
 */
describe('getCurrentPosition (web adapter)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { lat, lng } on success', async () => {
    const mockPosition = {
      coords: { latitude: 55.6, longitude: 13.0, accuracy: 10 },
      timestamp: Date.now(),
    };
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success(mockPosition as GeolocationPosition);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../get-current-position.web');
    const result = await getCurrentPosition();

    expect(result).toEqual({ lat: 55.6, lng: 13.0 });
  });

  it('throws LocationError with reason "permission_denied" when denied', async () => {
    const getCurrentPositionMock = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'User denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    );
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../get-current-position.web');

    await expect(getCurrentPosition()).rejects.toThrow(LocationError);
    await expect(getCurrentPosition()).rejects.toMatchObject({ reason: 'permission_denied' });
  });

  it('throws LocationError with reason "unavailable" when geolocation API missing', async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../get-current-position.web');

    await expect(getCurrentPosition()).rejects.toThrow(LocationError);
    await expect(getCurrentPosition()).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('throws LocationError with reason "timeout" on timeout', async () => {
    const getCurrentPositionMock = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 3, // TIMEOUT
          message: 'Timeout',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    );
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../get-current-position.web');

    await expect(getCurrentPosition()).rejects.toThrow(LocationError);
    await expect(getCurrentPosition()).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('passes enableHighAccuracy option to the browser API', async () => {
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 1, longitude: 2, accuracy: 5 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../get-current-position.web');
    await getCurrentPosition();

    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
  });
});
