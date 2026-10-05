/**
 * Pure 2D helpers for editing an overlay quad in a y-down pixel space.
 *
 * Quads are [topLeft, topRight, bottomRight, bottomLeft]. Corners move
 * independently (free skew); mid-side handles slide a side along the axis
 * between it and the opposite side.
 */

import type { Point } from '@/lib/homography';

export type Quad = [Point, Point, Point, Point];

const DEFAULT_MIN_SIZE = 10;

/** Smallest turn (px²) each corner must keep, so the quad never flattens to a line. */
const MIN_CORNER_CROSS = 1;

/** True for a non-degenerate convex quad wound clockwise on screen (tl, tr, br, bl). */
export function isConvexQuad(q: Quad): boolean {
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= MIN_CORNER_CROSS) return false;
  }
  return true;
}

/**
 * Apply `build(t)` for the largest t in [0, 1] that keeps the quad convex, so a drag stops at the
 * boundary instead of folding the image (a concave quad has no valid homography).
 */
function limitToConvex(start: Quad, build: (t: number) => Quad): Quad {
  const full = build(1);
  // Already-invalid quads (e.g. saved before this check) are left free to move.
  if (isConvexQuad(full) || !isConvexQuad(start)) return full;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (isConvexQuad(build(mid))) lo = mid;
    else hi = mid;
  }
  return build(lo);
}

/** Drag a single corner; the other three stay put. */
export function moveCorner(start: Quad, cornerIndex: number, dx: number, dy: number): Quad {
  return limitToConvex(start, (t) => {
    const next = start.map((p) => ({ ...p })) as Quad;
    next[cornerIndex] = {
      x: start[cornerIndex].x + dx * t,
      y: start[cornerIndex].y + dy * t,
    };
    return next;
  });
}

/** Midpoints of the top, right, bottom and left sides. */
export function edgeMidpoints(q: Quad): [Point, Point, Point, Point] {
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return [mid(q[0], q[1]), mid(q[1], q[2]), mid(q[2], q[3]), mid(q[3], q[0])];
}

/**
 * Drag a mid-side handle (0 top, 1 right, 2 bottom, 3 left): the side's two corners slide
 * along the axis from the opposite side, so only that dimension changes.
 */
export function resizeFromEdge(
  start: Quad,
  edgeIndex: number,
  dx: number,
  dy: number,
  minSize = DEFAULT_MIN_SIZE,
): Quad {
  const mids = edgeMidpoints(start);
  const here = mids[edgeIndex];
  const opposite = mids[(edgeIndex + 2) % 4];
  const ax = here.x - opposite.x;
  const ay = here.y - opposite.y;
  const len = Math.hypot(ax, ay) || 1;
  const axis = { x: ax / len, y: ay / len };

  // Never shrink past minSize or flip the side over the opposite one.
  const amount = Math.max(dx * axis.x + dy * axis.y, minSize - len);

  return limitToConvex(start, (t) => {
    const next = start.map((p) => ({ ...p })) as Quad;
    for (const i of [edgeIndex, (edgeIndex + 1) % 4]) {
      next[i] = { x: start[i].x + axis.x * amount * t, y: start[i].y + axis.y * amount * t };
    }
    return next;
  });
}

export function quadCenter(q: Quad): Point {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

/** Rotate in the screen plane around the quad's center (positive = clockwise on a y-down screen). */
export function rotateQuad(q: Quad, angle: number): Quad {
  const c = quadCenter(q);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return q.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  }) as Quad;
}

/** Rotation handle position: just outside the top edge, a fixed distance away. */
export function rotationHandlePoint(q: Quad, offset: number): Point {
  const c = quadCenter(q);
  const top = edgeMidpoints(q)[0];
  const len = Math.hypot(top.x - c.x, top.y - c.y) || 1;
  return {
    x: top.x + ((top.x - c.x) / len) * offset,
    y: top.y + ((top.y - c.y) / len) * offset,
  };
}
