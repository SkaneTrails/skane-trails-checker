/**
 * Spacing, border radius, and shadow constants.
 *
 * Spacing and border-radius are static (theme-independent) — they provide
 * consistent rhythm regardless of the active color palette.
 *
 * Shadows are per-theme because they reference the theme's shadow color.
 * The defaults here use neutral black and suit the Nature theme.
 */

/** Named spacing scale — consistent rhythm across the app. */
export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 6,
  md: 8,
  'md-lg': 10,
  lg: 12,
  'lg-xl': 14,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
} as const;

/** Structural contract for the spacing scale. */
export type SpacingTokens = typeof spacing;

/** Named border-radius scale (smallest to pill / circle). */
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Structural contract for border-radius tokens. */
export type BorderRadiusTokens = typeof borderRadius;

/**
 * Shadow presets using the RN 0.76+ `boxShadow` shorthand.
 *
 * Format: `offsetX offsetY blurRadius spreadRadius color`.
 */
export const shadows = {
  none: { boxShadow: '0px 0px 0px 0px transparent' },
  sm: { boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1)' },
  md: { boxShadow: '0px 2px 6px 0px rgba(0, 0, 0, 0.1)' },
  lg: { boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)' },
} as const;

/** Structural contract for shadow presets. */
export type ShadowTokens = {
  readonly [K in keyof typeof shadows]: { readonly boxShadow: string };
};
