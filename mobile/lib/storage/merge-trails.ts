import type { Trail } from '@/lib/types';

/** Apply a delta to a trail list: changed trails replace or join, deleted ids drop out. */
export function mergeTrails(existing: Trail[], changed: Trail[], deletedIds: string[]): Trail[] {
  const byId = new Map(existing.map((trail) => [trail.trail_id, trail]));
  for (const trail of changed) byId.set(trail.trail_id, trail);
  for (const id of deletedIds) byId.delete(id);
  return Array.from(byId.values());
}
