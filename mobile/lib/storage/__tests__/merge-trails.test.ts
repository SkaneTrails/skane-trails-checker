import { describe, expect, it } from 'vitest';
import type { Trail } from '@/lib/types';
import { mergeTrails } from '../merge-trails';

const trail = (id: string, name = id): Trail => ({
  trail_id: id,
  name,
  status: 'To Explore',
  source: 'other_trails',
  length_km: 1,
  difficulty: 'Easy',
  coordinates_map: [],
  bounds: { north: 1, south: 0, east: 1, west: 0 },
  center: { lat: 0, lng: 0 },
  last_updated: '2026-01-01T00:00:00Z',
});

describe('mergeTrails', () => {
  it('adds new trails and keeps the rest', () => {
    const result = mergeTrails([trail('a')], [trail('b')], []);
    expect(result.map((t) => t.trail_id)).toEqual(['a', 'b']);
  });

  it('replaces a trail that changed', () => {
    const result = mergeTrails([trail('a', 'old')], [trail('a', 'new')], []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('new');
  });

  it('removes deleted trails', () => {
    const result = mergeTrails([trail('a'), trail('b')], [], ['a']);
    expect(result.map((t) => t.trail_id)).toEqual(['b']);
  });

  it('lets a deletion win over a change to the same trail', () => {
    expect(mergeTrails([], [trail('a')], ['a'])).toEqual([]);
  });

  it('ignores deletions of unknown trails', () => {
    expect(mergeTrails([trail('a')], [], ['zzz'])).toHaveLength(1);
  });
});
