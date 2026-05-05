import { describe, expect, it } from 'vitest';
import { LocationError } from '../types';
import type { Coords } from '../types';

/**
 * Contract tests for the location service types.
 * Verifies the shared interface contracts that both platform
 * adapters must fulfil.
 */
describe('Location service contract', () => {
  describe('Coords type', () => {
    it('represents a coordinate pair with lat and lng', () => {
      const coords: Coords = { lat: 55.6, lng: 13.0 };
      expect(coords.lat).toBe(55.6);
      expect(coords.lng).toBe(13.0);
    });
  });

  describe('LocationError', () => {
    it('is an Error subclass', () => {
      const err = new LocationError('permission_denied');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(LocationError);
    });

    it('has a reason property', () => {
      const err = new LocationError('timeout', 'Request timed out');
      expect(err.reason).toBe('timeout');
      expect(err.message).toBe('Request timed out');
    });

    it('generates default message from reason', () => {
      const err = new LocationError('unavailable');
      expect(err.message).toBe('Location error: unavailable');
    });

    it('has name set to LocationError', () => {
      const err = new LocationError('unknown');
      expect(err.name).toBe('LocationError');
    });

    it.each(['permission_denied', 'unavailable', 'timeout', 'unknown'] as const)(
      'accepts reason "%s"',
      (reason) => {
        const err = new LocationError(reason);
        expect(err.reason).toBe(reason);
      },
    );
  });
});
