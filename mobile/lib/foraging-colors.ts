/**
 * Refined color palette for foraging types.
 *
 * Maps the crude color names from the API ("red", "blue", "brown", etc.)
 * to a nature-inspired, theme-coherent palette.
 */

const REFINED_COLORS: Record<string, string> = {
  red: '#D64545',
  blue: '#5B8DEF',
  darkgreen: '#2D6A4F',
  green: '#4A9E6F',
  brown: '#8B6B4A',
  saddlebrown: '#7A5C3A',
  gray: '#8E99A4',
};

const FALLBACK_COLOR = '#8E99A4';

/** Resolve an API color name to a refined hex value. */
export function foragingColor(apiColor: string | undefined): string {
  if (!apiColor) return FALLBACK_COLOR;
  return REFINED_COLORS[apiColor] ?? FALLBACK_COLOR;
}

/** Build a lookup map from type name → hex color, given the types array. */
export function foragingColorMap(
  types: ReadonlyArray<{ name: string; color?: string }>,
): Map<string, string> {
  return new Map(types.map((t) => [t.name, foragingColor(t.color)]));
}
