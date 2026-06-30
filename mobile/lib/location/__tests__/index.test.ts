import { describe, expect, it, vi } from 'vitest';

/**
 * Tests the public barrel entrypoint (@/lib/location) that consumers
 * like foraging.tsx actually import from. Ensures re-exports are wired
 * correctly and getCurrentPosition is callable via the public API.
 */
describe('@/lib/location entrypoint', () => {
  it('exports getCurrentPosition function', async () => {
    const mod = await import('../index');
    expect(mod.getCurrentPosition).toBeTypeOf('function');
  });

  it('exports LocationError class', async () => {
    const mod = await import('../index');
    expect(mod.LocationError).toBeTypeOf('function');
    const err = new mod.LocationError('timeout');
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe('timeout');
  });

  it('getCurrentPosition resolves via the public entrypoint', async () => {
    const mockPosition = {
      coords: { latitude: 55.6, longitude: 13.0, accuracy: 10 },
      timestamp: Date.now(),
    };
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success(mockPosition as GeolocationPosition);
        }),
      },
      writable: true,
      configurable: true,
    });

    const { getCurrentPosition } = await import('../index');
    const result = await getCurrentPosition();

    expect(result).toEqual({ lat: 55.6, lng: 13.0 });
  });
});
