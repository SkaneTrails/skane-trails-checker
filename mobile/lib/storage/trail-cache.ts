/**
 * Platform-agnostic trail cache.
 *
 * Metro/webpack resolves:
 * - trail-cache.web.ts on web (IndexedDB)
 * - trail-cache.native.ts on native (AsyncStorage)
 *
 * This file exists as the base fallback (e.g. for tests/Node).
 */
export { trailCache } from './trail-cache.web';
export type { CachedTrailData } from './trail-cache.web';
