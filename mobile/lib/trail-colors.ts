/**
 * Trail line color palette — must match TRAIL_COLORS in api/models/trail.py.
 */

export const TRAIL_COLORS = [
  '#E53E3E',
  '#4169E1',
  '#ECC94B',
  '#38A169',
  '#FF8000',
  '#805AD5',
  '#63B3ED',
  '#ED64A6',
  '#FFFFFF',
  '#1A1A1A',
] as const;

/** Default color for planned hikes (To Explore). */
export const DEFAULT_PLANNED_COLOR = '#E53E3E';

/** Default color for completed hikes (Explored!). */
export const DEFAULT_COMPLETED_COLOR = '#4169E1';
