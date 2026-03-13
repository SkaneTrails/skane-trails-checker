/**
 * Layout tokens — spacing, border radius, shadows, glass effects.
 *
 * Shared across all themes (not per-theme).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 28,
  pill: 20,
  full: 9999,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const blur = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;

export const sheet = {
  handleWidth: 36,
  handleHeight: 4,
  peekHeight: 120,
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
    entrance: 700,
  },
  easing: {
    spring: 'cubic-bezier(0.25, 1, 0.5, 1)',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const;

export interface ShadowTokens {
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  subtle: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  elevated: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}
