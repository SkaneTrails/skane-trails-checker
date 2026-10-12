import { describe, expect, it } from 'vitest';
import {
  edgeMidpoints,
  isConvexQuad,
  moveCorner,
  type Quad,
  quadCenter,
  resizeFromEdge,
  rotateQuad,
  rotationHandlePoint,
} from '../overlay-transform';

const rect: Quad = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 200 },
  { x: 100, y: 200 },
];

const width = (q: Quad) => Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
const height = (q: Quad) => Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y);

describe('moveCorner', () => {
  it('moves only the dragged corner', () => {
    const q = moveCorner(rect, 2, 50, 30);
    expect(q[0]).toEqual(rect[0]);
    expect(q[1]).toEqual(rect[1]);
    expect(q[3]).toEqual(rect[3]);
    expect(q[2]).toEqual({ x: 350, y: 230 });
  });

  it('does not mutate the input', () => {
    moveCorner(rect, 0, 10, 10);
    expect(rect[0]).toEqual({ x: 100, y: 100 });
  });

  it('stops at the boundary when dragged through the opposite corner', () => {
    const q = moveCorner(rect, 2, -500, -500);
    expect(isConvexQuad(q)).toBe(true);
    expect(q[2].x).toBeGreaterThan(rect[0].x);
    expect(q[2].y).toBeGreaterThan(rect[0].y);
  });

  it('stops at the boundary when dragged across a neighbouring edge', () => {
    const q = moveCorner(rect, 2, 0, -500);
    expect(isConvexQuad(q)).toBe(true);
    expect(q[2].y).toBeGreaterThan(q[1].y);
  });

  it('moves freely while the quad stays convex', () => {
    expect(isConvexQuad(moveCorner(rect, 3, -200, 150))).toBe(true);
  });

  it('leaves an already-invalid quad free to move', () => {
    const bowtie: Quad = [rect[0], rect[1], rect[3], rect[2]];
    expect(moveCorner(bowtie, 0, 5, 5)[0]).toEqual({ x: 105, y: 105 });
  });
});

describe('isConvexQuad', () => {
  it('accepts a clockwise rectangle and a skewed convex quad', () => {
    expect(isConvexQuad(rect)).toBe(true);
    expect(isConvexQuad(moveCorner(rect, 2, 60, 40))).toBe(true);
  });

  it('rejects bowties, concave quads, counter-clockwise winding and collapsed quads', () => {
    expect(isConvexQuad([rect[0], rect[1], rect[3], rect[2]])).toBe(false);
    expect(isConvexQuad([rect[0], rect[1], { x: 150, y: 150 }, rect[3]])).toBe(false);
    expect(isConvexQuad([rect[0], rect[3], rect[2], rect[1]])).toBe(false);
    expect(isConvexQuad([rect[0], rect[1], { x: 300, y: 100 }, { x: 100, y: 100 }])).toBe(false);
  });
});

describe('resizeFromEdge', () => {
  it('right edge changes only the width', () => {
    const q = resizeFromEdge(rect, 1, 60, 999);
    expect(width(q)).toBeCloseTo(260);
    expect(height(q)).toBeCloseTo(100);
    expect(q[0]).toEqual(rect[0]);
  });

  it('top edge changes only the height and keeps the bottom fixed', () => {
    const q = resizeFromEdge(rect, 0, 999, -40);
    expect(width(q)).toBeCloseTo(200);
    expect(height(q)).toBeCloseTo(140);
    expect(q[2].x).toBeCloseTo(300);
    expect(q[2].y).toBeCloseTo(200);
  });

  it('does not collapse below the minimum size', () => {
    const q = resizeFromEdge(rect, 1, -1000, 0, 10);
    expect(width(q)).toBeCloseTo(10);
  });

  it('keeps a skewed corner where it was while sliding its side', () => {
    const skewed = moveCorner(rect, 2, 40, 0);
    const q = resizeFromEdge(skewed, 0, 0, -20);
    expect(q[2]).toEqual(skewed[2]);
    expect(q[3]).toEqual(skewed[3]);
  });

  it('works along the rotated axes after rotation', () => {
    const rotated = rotateQuad(rect, Math.PI / 2);
    const q = resizeFromEdge(rotated, 1, 0, 50);
    expect(width(q)).toBeCloseTo(250);
    expect(height(q)).toBeCloseTo(100);
  });
});

describe('rotateQuad', () => {
  it('preserves size and center', () => {
    const q = rotateQuad(rect, 0.7);
    expect(width(q)).toBeCloseTo(200);
    expect(height(q)).toBeCloseTo(100);
    expect(quadCenter(q).x).toBeCloseTo(200);
    expect(quadCenter(q).y).toBeCloseTo(150);
  });

  it('quarter turn moves top-left to top-right', () => {
    const q = rotateQuad(rect, Math.PI / 2);
    expect(q[0].x).toBeCloseTo(250);
    expect(q[0].y).toBeCloseTo(50);
  });
});

describe('handle points', () => {
  it('edge midpoints are top, right, bottom, left', () => {
    const [top, right, bottom, left] = edgeMidpoints(rect);
    expect(top).toEqual({ x: 200, y: 100 });
    expect(right).toEqual({ x: 300, y: 150 });
    expect(bottom).toEqual({ x: 200, y: 200 });
    expect(left).toEqual({ x: 100, y: 150 });
  });

  it('rotation handle sits a fixed distance beyond the top edge', () => {
    const p = rotationHandlePoint(rect, 30);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(70);
  });
});
