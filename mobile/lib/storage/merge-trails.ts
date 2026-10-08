import type { Trail } from '@/lib/types';

/**
 * Apply a delta to a trail list: deleted ids drop out, then changed trails replace or join.
 * The server never reports a trail as both, but if it did the changed copy is the current one.
 */
export function mergeTrails(existing: Trail[], changed: Trail[], deletedIds: string[]): Trail[] {
  const byId = new Map(existing.map((trail) => [trail.trail_id, trail]));
  for (const id of deletedIds) byId.delete(id);
  for (const trail of changed) byId.set(trail.trail_id, trail);
  return Array.from(byId.values());
}
