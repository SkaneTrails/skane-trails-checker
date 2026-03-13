/**
 * Typography tokens — font sizes, weights, spacing, and line heights.
 *
 * Shared across all themes.
 */

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  title: 28,
  hero: 34,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const letterSpacing = {
  tight: -0.3,
  normal: 0,
  wide: 0.5,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;
