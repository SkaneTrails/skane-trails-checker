/**
 * Trail line color palette — must match TRAIL_COLORS in api/models/trail.py.
 */

export interface TrailColor {
  hex: string;
  labelKey: string;
}

export const TRAIL_COLORS: TrailColor[] = [
  { hex: '#E53E3E', labelKey: 'colors.red' },
  { hex: '#4169E1', labelKey: 'colors.blue' },
  { hex: '#ECC94B', labelKey: 'colors.yellow' },
  { hex: '#38A169', labelKey: 'colors.green' },
  { hex: '#FF8000', labelKey: 'colors.orange' },
  { hex: '#805AD5', labelKey: 'colors.purple' },
  { hex: '#63B3ED', labelKey: 'colors.lightBlue' },
  { hex: '#ED64A6', labelKey: 'colors.pink' },
  { hex: '#FFFFFF', labelKey: 'colors.white' },
  { hex: '#1A1A1A', labelKey: 'colors.black' },
];

/** Default color for planned hikes (To Explore). */
export const DEFAULT_PLANNED_COLOR = '#E53E3E';

/** Default color for completed hikes (Explored!). */
export const DEFAULT_COMPLETED_COLOR = '#4169E1';
