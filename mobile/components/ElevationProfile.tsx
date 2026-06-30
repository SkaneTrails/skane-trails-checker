/**
 * Minimal elevation profile curve for trail cards.
 *
 * Renders an elevation profile as a filled SVG area with a
 * small max-height label on the right edge.
 * Baseline = hike's lowest point; Y-axis cap = 400 m so flat
 * trails appear flat. Label shows relative elevation range.
 */

import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import type { Coordinate } from '@/lib/types';

interface ElevationProfileProps {
  coordinates: Coordinate[];
  width?: number;
  height?: number;
}

const MAX_POINTS = 120;
const SKANE_SCALE_M = 150;
const WORLD_SCALE_M = 400;
const LABEL_WIDTH = 32;

// Approximate bounding box for Skåne
const SKANE_BOUNDS = { south: 55.35, north: 56.45, west: 12.75, east: 14.45 };

function isInSkane(coords: Coordinate[]): boolean {
  return coords.some(
    (c) =>
      c.lat >= SKANE_BOUNDS.south &&
      c.lat <= SKANE_BOUNDS.north &&
      c.lng >= SKANE_BOUNDS.west &&
      c.lng <= SKANE_BOUNDS.east,
  );
}

function downsample(coords: Coordinate[], maxPoints: number): Coordinate[] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: Coordinate[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}

export const ElevationProfile = ({
  coordinates,
  width = 300,
  height = 60,
}: ElevationProfileProps) => {
  const { colors } = useTheme();

  const elevations = coordinates
    .filter((c) => c.elevation != null)
    .map((c) => c.elevation!);

  if (elevations.length < 2) return null;

  const sampled = downsample(
    coordinates.filter((c) => c.elevation != null),
    MAX_POINTS,
  );
  const sampledElevations = sampled.map((c) => c.elevation!);

  const minElev = Math.min(...sampledElevations);
  const maxElev = Math.max(...sampledElevations);
  const elevRange = maxElev - minElev;
  const baseScale = isInSkane(coordinates) ? SKANE_SCALE_M : WORLD_SCALE_M;
  const scaleM = Math.max(baseScale, elevRange);

  const padY = 4;
  const drawHeight = height - padY * 2;
  const chartWidth = width - LABEL_WIDTH;

  const points = sampledElevations.map((elev, i) => {
    const x = (i / (sampledElevations.length - 1)) * chartWidth;
    const y = padY + drawHeight - ((elev - minElev) / scaleM) * drawHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fillPath = `${linePath} L${chartWidth},${height} L0,${height} Z`;

  const maxY = padY + drawHeight - (elevRange / scaleM) * drawHeight;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={fillPath} fill={colors.primary} opacity={0.15} />
      <Path d={linePath} stroke={colors.primary} strokeWidth={1.5} fill="none" opacity={0.6} />
      <SvgText
        x={chartWidth + 4}
        y={maxY}
        fill={colors.text.muted}
        fontSize={9}
        alignmentBaseline="middle"
      >
        {Math.round(elevRange)} m
      </SvgText>
    </Svg>
  );
};
