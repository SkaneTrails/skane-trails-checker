import { describe, expect, it } from 'vitest';
import { matrix3dForQuad, type Point } from '../homography';

/** Parse a `matrix3d(a,b,c,...)` string into a 16-number array. */
function parseMatrix3d(value: string): number[] {
  const match = value.match(/^matrix3d\(([^)]+)\)$/);
  if (!match) throw new Error(`Not a matrix3d string: ${value}`);
  return match[1].split(',').map(Number);
}

/**
 * Apply a CSS matrix3d (column-major 4x4) to a 2D point (z = 0) and return the
 * projected 2D screen coordinates after the perspective divide.
 */
function project(matrix: number[], x: number, y: number): Point {
  const m = matrix;
  // Column-major: element index = col * 4 + row.
  const clipX = m[0] * x + m[4] * y + m[12];
  const clipY = m[1] * x + m[5] * y + m[13];
  const clipW = m[3] * x + m[7] * y + m[15];
  return { x: clipX / clipW, y: clipY / clipW };
}

const corners: [Point, Point, Point, Point] = [
  { x: 100, y: 50 }, // top-left
  { x: 400, y: 80 }, // top-right
  { x: 380, y: 300 }, // bottom-right
  { x: 120, y: 280 }, // bottom-left
];

describe('matrix3dForQuad', () => {
  it('maps each source corner onto its destination point', () => {
    const srcW = 200;
    const srcH = 150;
    const matrix = parseMatrix3d(matrix3dForQuad(srcW, srcH, corners));

    const src: Array<[number, number]> = [
      [0, 0],
      [srcW, 0],
      [srcW, srcH],
      [0, srcH],
    ];

    src.forEach(([x, y], i) => {
      const p = project(matrix, x, y);
      expect(p.x).toBeCloseTo(corners[i].x, 4);
      expect(p.y).toBeCloseTo(corners[i].y, 4);
    });
  });

  it('produces an identity-like mapping for an axis-aligned rectangle', () => {
    const rect: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ];
    const matrix = parseMatrix3d(matrix3dForQuad(200, 100, rect));
    const mid = project(matrix, 100, 50);
    expect(mid.x).toBeCloseTo(100, 4);
    expect(mid.y).toBeCloseTo(50, 4);
  });

  it('returns a well-formed matrix3d string with 16 components', () => {
    const matrix = parseMatrix3d(matrix3dForQuad(10, 10, corners));
    expect(matrix).toHaveLength(16);
    expect(matrix.every((n) => Number.isFinite(n))).toBe(true);
  });
});
