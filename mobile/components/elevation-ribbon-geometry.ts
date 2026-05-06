import type { Coordinate } from '@/lib/types';

export interface RibbonGeometryData {
  positions: Float32Array;
  indices: Uint32Array;
  /** Normalized elevation per vertex (0 = min, 1 = max) for gradient coloring */
  elevationFactors: Float32Array;
  center: [number, number, number];
  size: [number, number, number];
  /** Projected screen-space extent [width, height] from south-facing oblique camera */
  projectedSize: [number, number];
}

/**
 * Convert lat/lng coordinates to local XY meters relative to trail center.
 * Uses equirectangular approximation (accurate enough for Skåne-scale trails).
 */
function toLocalMeters(
  coords: Coordinate[],
  centerLat: number,
  centerLng: number,
): { x: number; z: number; ele: number }[] {
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  return coords.map((c) => ({
    x: (c.lng - centerLng) * 111320 * cosLat,
    z: -(c.lat - centerLat) * 110540, // negative so north goes "into" screen
    ele: c.elevation ?? 0,
  }));
}

// Approximate bounding box for Skåne
const SKANE_BOUNDS = { south: 55.35, north: 56.45, west: 12.75, east: 14.45 };
const SKANE_SCALE_M = 150;
const WORLD_SCALE_M = 400;

function isInSkane(coords: Coordinate[]): boolean {
  return coords.some(
    (c) =>
      c.lat >= SKANE_BOUNDS.south &&
      c.lat <= SKANE_BOUNDS.north &&
      c.lng >= SKANE_BOUNDS.west &&
      c.lng <= SKANE_BOUNDS.east,
  );
}

/**
 * Build ribbon geometry from trail coordinates with exaggerated elevation.
 *
 * Creates a vertical "wall" following the trail shape, where the top edge
 * represents elevation and bottom edge is at ground level.
 */
export function buildRibbonGeometry(coordinates: Coordinate[]): RibbonGeometryData | null {
  const withElevation = coordinates.filter((c) => c.elevation != null);
  if (withElevation.length < 2) return null;

  // Use simplified subset for performance (max ~500 points)
  const step = Math.max(1, Math.floor(withElevation.length / 500));
  const coords = withElevation.filter((_, i) => i % step === 0 || i === withElevation.length - 1);
  const n = coords.length;
  if (n < 2) return null;

  // Find center
  const centerLat = coords.reduce((s, c) => s + c.lat, 0) / n;
  const centerLng = coords.reduce((s, c) => s + c.lng, 0) / n;

  // Convert to local meters
  const local = toLocalMeters(coords, centerLat, centerLng);

  // Calculate total horizontal distance and elevation range
  let totalDist = 0;
  for (let i = 1; i < n; i++) {
    const dx = local[i].x - local[i - 1].x;
    const dz = local[i].z - local[i - 1].z;
    totalDist += Math.sqrt(dx * dx + dz * dz);
  }

  const minEle = Math.min(...local.map((p) => p.ele));
  const maxEle = Math.max(...local.map((p) => p.ele));
  const eleRange = maxEle - minEle || 1;

  // Use same scaling as ElevationProfile SVG:
  // Y-axis cap = SKANE_SCALE_M (150m) for Skåne trails, WORLD_SCALE_M (400m) otherwise
  const baseScale = isInSkane(coords) ? SKANE_SCALE_M : WORLD_SCALE_M;
  const scaleM = Math.max(baseScale, eleRange);

  // Exaggeration: map elevation into a proportion of horizontal extent
  // that matches the visual weight of the SVG profile (~20% of trail width).
  // Cap so max elevation never exceeds 30% of the trail's horizontal span
  // (prevents mountain trails from becoming impossibly tall walls).
  let exaggeration = totalDist > 0 ? (totalDist * 0.20) / scaleM : 1;
  const horizontalSpan = Math.max(
    Math.max(...local.map((p) => p.x)) - Math.min(...local.map((p) => p.x)),
    Math.max(...local.map((p) => p.z)) - Math.min(...local.map((p) => p.z)),
  ) || totalDist;
  const maxHeight = horizontalSpan * 0.30;
  if (eleRange * exaggeration > maxHeight) {
    exaggeration = maxHeight / eleRange;
  }

  // Build vertices: 2 per point (bottom + top)
  const positions = new Float32Array(n * 2 * 3);
  const elevationFactors = new Float32Array(n * 2);

  for (let i = 0; i < n; i++) {
    const { x, z, ele } = local[i];
    const scaledEle = (ele - minEle) * exaggeration;
    const factor = (ele - minEle) / eleRange; // 0..1 for color gradient

    // Bottom vertex
    positions[i * 6] = x;
    positions[i * 6 + 1] = 0;
    positions[i * 6 + 2] = z;

    // Top vertex
    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = scaledEle;
    positions[i * 6 + 5] = z;

    // Elevation factor: bottom = 0, top = normalized elevation
    elevationFactors[i * 2] = 0;
    elevationFactors[i * 2 + 1] = factor;
  }

  // Build indices: 2 triangles per quad, (n-1) quads
  const indices = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const bl = i * 2; // bottom-left
    const tl = i * 2 + 1; // top-left
    const br = (i + 1) * 2; // bottom-right
    const tr = (i + 1) * 2 + 1; // top-right

    // Triangle 1: bl, br, tl
    indices[i * 6] = bl;
    indices[i * 6 + 1] = br;
    indices[i * 6 + 2] = tl;
    // Triangle 2: tl, br, tr
    indices[i * 6 + 3] = tl;
    indices[i * 6 + 4] = br;
    indices[i * 6 + 5] = tr;
  }

  // Calculate bounding box for camera framing
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < n * 2; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    if (pz < minZ) minZ = pz;
    if (pz > maxZ) maxZ = pz;
  }

  // Compute projected screen-space extent from south-facing oblique camera.
  // Camera looks from (0, 0.3, 0.7) direction toward center.
  // In orthographic projection, screen X = world X, screen Y = world Y * cos(tilt) + world Z * sin(tilt)
  // With tilt angle from: camera at y=0.3, z=0.7 → tilt ≈ atan2(0.3, 0.7) ≈ 23°
  const tiltAngle = Math.atan2(0.3, 0.7);
  const cosT = Math.cos(tiltAngle);
  const sinT = Math.sin(tiltAngle);

  let projMinX = Infinity, projMaxX = -Infinity;
  let projMinY = Infinity, projMaxY = -Infinity;
  for (let i = 0; i < n * 2; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    // Project: screen X = world X, screen Y = elevation contribution + depth foreshortening
    const screenX = px;
    const screenY = py * cosT - pz * sinT;
    if (screenX < projMinX) projMinX = screenX;
    if (screenX > projMaxX) projMaxX = screenX;
    if (screenY < projMinY) projMinY = screenY;
    if (screenY > projMaxY) projMaxY = screenY;
  }

  const projectedSize: [number, number] = [projMaxX - projMinX, projMaxY - projMinY];

  // Projected center: the world-space point whose projection lands at screen center.
  // screenX = worldX → projCenterX = (projMinX + projMaxX) / 2
  // screenY = worldY * cosT - worldZ * sinT → we need a 3D point that projects to center.
  // Use the 3D bounding box midpoint for Y/Z but correct X to projected midpoint.
  const projCenterX = (projMinX + projMaxX) / 2;
  const projCenterScreenY = (projMinY + projMaxY) / 2;
  // Solve for world Y given world Z = center Z:
  // projCenterScreenY = worldY * cosT - centerZ * sinT
  // worldY = (projCenterScreenY + centerZ * sinT) / cosT
  const centerZ = (minZ + maxZ) / 2;
  const projCenterY = (projCenterScreenY + centerZ * sinT) / cosT;

  return {
    positions,
    indices,
    elevationFactors,
    center: [projCenterX, projCenterY, centerZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    projectedSize,
  };
}
