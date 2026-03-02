/**
 * Theme context — provider and consumer hook.
 *
 * Wraps the app with a ThemeProvider to access the active theme via useTheme().
 * Simplified from meal-planner: no button display config, no visibility tokens,
 * no style overrides. Just colors + layout + typography.
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { ColorTokens } from './colors';
import type { ShadowTokens } from './layout';

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: ColorTokens;
  shadows: ShadowTokens;
}

export interface ThemeValue {
  colors: ColorTokens;
  shadows: ShadowTokens;
  id: string;
  name: string;
}

const ThemeContext = createContext<ThemeValue | null>(null);

interface ThemeProviderProps {
  theme: ThemeDefinition;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const value = useMemo<ThemeValue>(
    () => ({
      colors: theme.colors,
      shadows: theme.shadows,
      id: theme.id,
      name: theme.name,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
