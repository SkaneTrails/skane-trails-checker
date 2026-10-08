import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

/**
 * Trail queries that are too big for the saved query cache: it is one AsyncStorage entry
 * with a ~6 MB cap on Android, and one oversized query stops everything else being saved.
 * Map trails live in the local trail store, photos and full-resolution tracks are fetched on demand.
 */
const NOT_PERSISTED_TRAIL_QUERIES = new Set(['map', 'detail', 'details', 'images']);

export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const [root, kind] = query.queryKey;
  return !(root === 'trails' && NOT_PERSISTED_TRAIL_QUERIES.has(kind as string));
}
