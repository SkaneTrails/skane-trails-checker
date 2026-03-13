/**
 * Refined color palette for place categories.
 *
 * Maps category slugs to a nature-inspired, theme-coherent palette.
 * Each category gets a unique color for filter chips, card tags, and map dots.
 */

const CATEGORY_COLORS: Record<string, string> = {
  parkering: '#6B7280',
  vatten: '#3B82F6',
  'lagerplats-med-vindskydd': '#D97706',
  toalett: '#8B5CF6',
  kollektivtrafik: '#059669',
  boende: '#EC4899',
  badplats: '#06B6D4',
  'ata-dricka': '#EF4444',
  livsmedelgardsbutik: '#F59E0B',
  sevardhet: '#8B5CF6',
  aktivitet: '#10B981',
  turistinformation: '#6366F1',
  konst: '#F472B6',
  naturlekplats: '#22C55E',
};

const FALLBACK_COLOR = '#8E99A4';

/** Resolve a category slug to a refined hex color. */
export function placeCategoryColor(slug: string): string {
  return CATEGORY_COLORS[slug] ?? FALLBACK_COLOR;
}
