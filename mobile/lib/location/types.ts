/** Coordinates returned by the location service. */
export interface Coords {
  lat: number;
  lng: number;
}

/** Error thrown when location cannot be obtained. */
export class LocationError extends Error {
  constructor(
    public readonly reason: 'permission_denied' | 'unavailable' | 'timeout' | 'unknown',
    message?: string,
  ) {
    super(message ?? `Location error: ${reason}`);
    this.name = 'LocationError';
  }
}
