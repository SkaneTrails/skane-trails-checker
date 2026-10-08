/**
 * Platform-agnostic photo store.
 *
 * Metro resolves trail-image-store.web.ts on web (IndexedDB) and
 * trail-image-store.native.ts on native (files). This file is the fallback for tests/Node.
 */
export { trailImageStore } from './trail-image-store.web';
export type { CachedTrailImages } from './trail-image-store.web';
