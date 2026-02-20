import { describe, expect, test } from 'vitest';
import { natureColors } from '../colors';
import { defaultThemeId, isThemeId, themes } from '../themes';
import { natureTheme } from '../themes/nature';

describe('natureTheme', () => {
  test('has the correct id and name', () => {
    expect(natureTheme.id).toBe('nature');
    expect(natureTheme.name).toBe('Forest & Trails');
  });

  test('uses nature color palette', () => {
    expect(natureTheme.colors).toBe(natureColors);
  });

  test('does not override borderRadius (uses defaults)', () => {
    expect(natureTheme.borderRadius).toBeUndefined();
  });

  test('does not override shadows (uses defaults)', () => {
    expect(natureTheme.shadows).toBeUndefined();
  });
});

describe('theme registry', () => {
  test('contains the nature theme', () => {
    expect(themes.nature).toBe(natureTheme);
  });

  test('defaultThemeId is nature', () => {
    expect(defaultThemeId).toBe('nature');
  });

  test('isThemeId returns true for registered themes', () => {
    expect(isThemeId('nature')).toBe(true);
  });

  test('isThemeId returns false for unknown theme ids', () => {
    expect(isThemeId('dark')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(isThemeId('nonexistent')).toBe(false);
  });

  test('all registered themes have required fields', () => {
    for (const [id, theme] of Object.entries(themes)) {
      expect(theme.id, `${id} should have an id`).toBe(id);
      expect(theme.name.length, `${id} should have a name`).toBeGreaterThan(0);
      expect(theme.colors, `${id} should have colors`).toBeDefined();
    }
  });
});
