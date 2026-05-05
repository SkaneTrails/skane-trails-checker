import type { Coords } from './types';
import { LocationError } from './types';

/**
 * Get the user's current position using the browser Geolocation API.
 * Throws LocationError on failure.
 */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new LocationError('unavailable', 'Geolocation API not available'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new LocationError('permission_denied'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new LocationError('unavailable'));
            break;
          case error.TIMEOUT:
            reject(new LocationError('timeout'));
            break;
          default:
            reject(new LocationError('unknown'));
        }
      },
      { enableHighAccuracy: true },
    );
  });
}
