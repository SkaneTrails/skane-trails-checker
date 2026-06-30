/**
 * Platform-agnostic location service.
 *
 * Metro/webpack resolves:
 * - get-current-position.web.ts on web (navigator.geolocation)
 * - get-current-position.native.ts on native (expo-location)
 *
 * This file exists as the base fallback (e.g. for tests/Node).
 */
export { getCurrentPosition } from './get-current-position.web';
