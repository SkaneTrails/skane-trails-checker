import type { Coordinate } from '@/lib/types';

interface ElevationRibbonProps {
  coordinates: Coordinate[];
  height?: number;
  width?: number;
}

export function ElevationRibbon(props: ElevationRibbonProps): JSX.Element;
