/**
 * Platform-agnostic map trail store.
 *
 * Metro resolves map-trail-store.web.ts on web (IndexedDB) and
 * map-trail-store.native.ts on native (files). This file is the fallback for
 * tests/Node.
 */
export { mapTrailStore } from './map-trail-store.web';
export type { CachedMapTrails } from './map-trail-store.web';
