/**
 * Typography scale, weights, and preset styles.
 *
 * Font sizes and weights are static. The `createTypography` factory
 * builds reusable text-style presets that components can spread into
 * their `StyleSheet.create()` blocks.
 */

/** Named font-size scale covering all app text styles. */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 15,
  xl: 16,
  '2xl': 18,
  '3xl': 24,
} as const;

/** Structural contract for the font-size scale. */
export type FontSizeTokens = typeof fontSize;

/** Named font-weight scale. */
export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/** Structural contract for the font-weight scale. */
export type FontWeightTokens = typeof fontWeight;

/**
 * Build typography presets from the static size/weight scales.
 *
 * Returns a frozen object of named text styles suitable for
 * spreading into `StyleSheet.create()`.
 */
export const createTypography = () =>
  ({
    headingLarge: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold },
    headingMedium: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
    headingSmall: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold },

    bodyLarge: { fontSize: fontSize.xl, fontWeight: fontWeight.normal },
    bodyMedium: { fontSize: fontSize.md, fontWeight: fontWeight.normal },
    bodySmall: { fontSize: fontSize.sm, fontWeight: fontWeight.normal },

    labelLarge: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
    labelMedium: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    labelSmall: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

    caption: { fontSize: fontSize.sm, fontWeight: fontWeight.normal },
  }) as const;

/** Resolved typography presets (return type of `createTypography`). */
export type TypographyTokens = ReturnType<typeof createTypography>;

/** Default typography presets for direct import in non-hook contexts. */
export const typography = createTypography();
