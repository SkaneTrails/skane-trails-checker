/**
 * Minimal elevation profile curve for trail cards.
 *
 * Renders an elevation profile as a filled SVG area with a
 * small max-height label on the right edge.
 * Baseline = hike's lowest point; Y-axis cap = 400 m so
 * different hikes are visually comparable.
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
const MAX_SCALE_M = 400;
const LABEL_WIDTH = 32;

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

  const padY = 4;
  const drawHeight = height - padY * 2;
  const chartWidth = width - LABEL_WIDTH;

  const points = sampledElevations.map((elev, i) => {
    const x = (i / (sampledElevations.length - 1)) * chartWidth;
    const y = padY + drawHeight - ((elev - minElev) / MAX_SCALE_M) * drawHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fillPath = `${linePath} L${chartWidth},${height} L0,${height} Z`;

  // Position max label at its actual height on the chart
  const maxY = padY + drawHeight - ((maxElev - minElev) / MAX_SCALE_M) * drawHeight;

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
        {Math.round(maxElev)} m
      </SvgText>
    </Svg>
  );
};
