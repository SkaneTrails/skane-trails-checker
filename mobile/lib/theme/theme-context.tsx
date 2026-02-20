/**
 * Theme context and provider.
 *
 * Provides resolved design tokens via React context so that components
 * access colors, typography, spacing, border-radius, and shadows through
 * a single `useTheme()` hook instead of importing scattered constants.
 *
 * The `ThemeProvider` accepts a complete `ThemeDefinition` and derives
 * all consumable tokens from it. Switching themes re-renders the provider
 * subtree with the new token set.
 */

import type React from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { ColorTokens } from './colors';
import {
  type BorderRadiusTokens,
  borderRadius as defaultBorderRadius,
  shadows as defaultShadows,
  type ShadowTokens,
  type SpacingTokens,
  spacing,
} from './layout';
import { createTypography, type TypographyTokens } from './typography';

/** A complete set of design tokens that describes one visual theme. */
export interface ThemeDefinition {
  /** Unique registry key — used for storage and lookup. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;

  readonly colors: ColorTokens;

  /** Themes may override radius/shadow scales; defaults come from layout.ts. */
  readonly borderRadius?: BorderRadiusTokens;
  readonly shadows?: ShadowTokens;
}

/** Resolved tokens exposed to components via `useTheme()`. */
export interface ThemeValue {
  readonly colors: ColorTokens;
  readonly typography: TypographyTokens;
  readonly spacing: SpacingTokens;
  readonly borderRadius: BorderRadiusTokens;
  readonly shadows: ShadowTokens;

  /** Registry key of the active theme. */
  readonly themeName: string;
  /** Switch to a different theme by registry key. */
  readonly setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** Read the current theme. Must be called inside a `ThemeProvider`. */
export const useTheme = (): ThemeValue => {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return value;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Complete theme definition — required, no fallback. */
  theme: ThemeDefinition;
  /** Callback to switch theme by registry key. */
  setThemeName?: (name: string) => void;
}

const noop = () => {};

/** Wraps children with the resolved theme value. */
export const ThemeProvider = ({ children, theme, setThemeName = noop }: ThemeProviderProps) => {
  const value = useMemo<ThemeValue>(() => {
    const {
      id,
      colors,
      borderRadius: radii = defaultBorderRadius,
      shadows: shadowTokens = defaultShadows,
    } = theme;

    return {
      colors,
      typography: createTypography(),
      spacing,
      borderRadius: radii,
      shadows: shadowTokens,
      themeName: id,
      setThemeName,
    };
  }, [theme, setThemeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
