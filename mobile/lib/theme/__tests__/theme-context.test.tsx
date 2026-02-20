import { renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { natureColors } from '../colors';
import { borderRadius, shadows, spacing } from '../layout';
import type { ThemeDefinition } from '../theme-context';
import { ThemeProvider, useTheme } from '../theme-context';
import { natureTheme } from '../themes/nature';
import { typography } from '../typography';

function createThemeWrapper(theme: ThemeDefinition, setThemeName?: (name: string) => void) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider theme={theme} setThemeName={setThemeName}>
        {children}
      </ThemeProvider>
    );
  };
}

describe('useTheme', () => {
  test('throws when used outside ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
  });

  test('returns colors from the provided theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.colors).toEqual(natureColors);
  });

  test('returns typography presets', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.typography).toEqual(typography);
  });

  test('returns spacing tokens', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.spacing).toEqual(spacing);
  });

  test('returns default borderRadius when theme omits it', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.borderRadius).toEqual(borderRadius);
  });

  test('returns default shadows when theme omits it', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.shadows).toEqual(shadows);
  });

  test('returns custom borderRadius when theme provides it', () => {
    const customRadii = { xs: 2, sm: 4, md: 6, lg: 8, xl: 10, full: 9999 } as const;
    const customTheme: ThemeDefinition = {
      ...natureTheme,
      id: 'custom',
      borderRadius: customRadii,
    };
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(customTheme),
    });
    expect(result.current.borderRadius).toEqual(customRadii);
  });

  test('returns custom shadows when theme provides them', () => {
    const customShadows = {
      none: { boxShadow: '0px 0px 0px 0px transparent' },
      sm: { boxShadow: '0px 1px 2px 0px rgba(0, 255, 0, 0.2)' },
      md: { boxShadow: '0px 2px 4px 0px rgba(0, 255, 0, 0.3)' },
      lg: { boxShadow: '0px 4px 8px 0px rgba(0, 255, 0, 0.4)' },
    } as const;
    const customTheme: ThemeDefinition = {
      ...natureTheme,
      id: 'custom',
      shadows: customShadows,
    };
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(customTheme),
    });
    expect(result.current.shadows).toEqual(customShadows);
  });

  test('returns the theme id as themeName', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });
    expect(result.current.themeName).toBe('nature');
  });

  test('provides setThemeName callback', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme, setter),
    });

    result.current.setThemeName('dark');
    expect(setter).toHaveBeenCalledWith('dark');
    expect(setter).toHaveBeenCalledTimes(1);
  });

  test('provides a no-op setThemeName when none is given', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });

    expect(() => result.current.setThemeName('anything')).not.toThrow();
  });
});

describe('ThemeProvider', () => {
  test('memoizes value across re-renders when theme is stable', () => {
    const { result, rerender } = renderHook(() => useTheme(), {
      wrapper: createThemeWrapper(natureTheme),
    });

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });
});
