/**
 * 2D projective transform (homography) helpers for warping a rectangular image
 * into an arbitrary quadrilateral.
 *
 * Used to render a map overlay image so its four source corners map exactly to
 * four destination screen-pixel points. This is plain 2D matrix math (no 3D
 * engine) — `matrix3d` is only the CSS mechanism used to apply the result to a
 * DOM element.
 */

/** A 3x3 matrix in row-major order (9 elements). */
type Matrix3x3 = number[];

/** A 2D point in pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** Compute the adjugate (classical adjoint) of a 3x3 matrix. */
function adjugate(m: Matrix3x3): Matrix3x3 {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}

/** Multiply two 3x3 matrices (row-major). */
function multiplyMatrices(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  const result: Matrix3x3 = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += a[3 * i + k] * b[3 * k + j];
      }
      result[3 * i + j] = sum;
    }
  }
  return result;
}

/** Multiply a 3x3 matrix by a 3-vector. */
function multiplyMatrixVector(m: Matrix3x3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/**
 * Build the projection mapping the canonical unit basis to the given four
 * points. Used by {@link general2DProjection}.
 */
function basisToPoints(p0: Point, p1: Point, p2: Point, p3: Point): Matrix3x3 {
  const m: Matrix3x3 = [p0.x, p1.x, p2.x, p0.y, p1.y, p2.y, 1, 1, 1];
  const v = multiplyMatrixVector(adjugate(m), [p3.x, p3.y, 1]);
  return multiplyMatrices(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/**
 * Compute the 3x3 homography mapping source points s0..s3 to destination
 * points d0..d3.
 */
function general2DProjection(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point],
): Matrix3x3 {
  const s = basisToPoints(src[0], src[1], src[2], src[3]);
  const d = basisToPoints(dst[0], dst[1], dst[2], dst[3]);
  return multiplyMatrices(d, adjugate(s));
}

/**
 * Compute a CSS `matrix3d(...)` string that warps an element whose box is
 * `srcWidth` x `srcHeight` (with `transform-origin: 0 0`) so its corners land
 * on the four destination points.
 *
 * @param srcWidth Source element width in pixels (e.g. image natural width).
 * @param srcHeight Source element height in pixels.
 * @param corners Destination points in the order [topLeft, topRight, bottomRight, bottomLeft].
 */
export function matrix3dForQuad(
  srcWidth: number,
  srcHeight: number,
  corners: [Point, Point, Point, Point],
): string {
  const src: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: srcWidth, y: 0 },
    { x: srcWidth, y: srcHeight },
    { x: 0, y: srcHeight },
  ];
  const t = general2DProjection(src, corners);

  // Normalise so the bottom-right element is 1 (improves numerical stability).
  const normalised = t.map((value) => value / t[8]);

  // CSS matrix3d is column-major. Map the 3x3 homography into the 4x4 form,
  // leaving the z axis as identity.
  const m = normalised;
  const matrix3d = [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];

  return `matrix3d(${matrix3d.join(',')})`;
}
