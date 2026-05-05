import * as Location from 'expo-location';
import type { Coords } from './types';
import { LocationError } from './types';

/**
 * Get the user's current position using expo-location (native).
 * Throws LocationError on failure.
 */
export async function getCurrentPosition(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError('permission_denied', 'Location permission not granted');
  }

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
    };
  } catch {
    throw new LocationError('unknown', 'Failed to get native position');
  }
}
