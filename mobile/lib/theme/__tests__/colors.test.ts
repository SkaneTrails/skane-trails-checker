import { describe, expect, test } from 'vitest';
import { type ColorTokens, natureColors } from '../colors';

describe('natureColors', () => {
  test('matches the ColorTokens interface', () => {
    const _typeCheck: ColorTokens = natureColors;
    expect(_typeCheck).toBeDefined();
  });

  test('provides all brand colors', () => {
    expect(natureColors.primary).toBe('#1a5e2a');
    expect(natureColors.primaryDark).toBe('#145221');
  });

  test('provides all background colors', () => {
    expect(natureColors.background).toBe('#f5f5f5');
    expect(natureColors.surface).toBe('#ffffff');
    expect(natureColors.overlay).toBe('rgba(0, 0, 0, 0.6)');
  });

  test('provides complete text color hierarchy', () => {
    const { text } = natureColors;
    expect(text.primary).toBe('#333333');
    expect(text.secondary).toBe('#666666');
    expect(text.tertiary).toBe('#999999');
    expect(text.muted).toBe('#888888');
    expect(text.inverse).toBe('#ffffff');
    expect(text.link).toBe('#1a5e2a');
  });

  test('provides trail status colors with bg and line variants', () => {
    const { status } = natureColors;
    expect(status.explored.bg).toBe('#d4edda');
    expect(status.explored.line).toBe('#2d8a4e');
    expect(status.toExplore.bg).toBe('#f8d7da');
    expect(status.toExplore.line).toBe('#dc3545');
  });

  test('provides error color', () => {
    expect(natureColors.error).toBe('#cc0000');
  });

  test('provides neutral colors', () => {
    expect(natureColors.border).toBe('#eeeeee');
    expect(natureColors.shadow).toBe('#000000');
  });

  test('provides tag colors for all categories', () => {
    const { tag } = natureColors;
    expect(tag.foraging.bg).toBe('#e8f5e9');
    expect(tag.foraging.text).toBe('#1a5e2a');
    expect(tag.place.bg).toBe('#e3f2fd');
    expect(tag.place.text).toBe('#1565c0');
    expect(tag.inactive.bg).toBe('#eeeeee');
    expect(tag.inactive.text).toBe('#666666');
  });

  test('all color values are non-empty strings', () => {
    const flatColors = flattenColorTokens(natureColors);
    for (const [path, value] of flatColors) {
      expect(value, `${path} should be a non-empty string`).toBeTruthy();
      expect(typeof value, `${path} should be a string`).toBe('string');
    }
  });
});

/** Recursively flatten a ColorTokens object into [path, value] pairs. */
function flattenColorTokens(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      entries.push(...flattenColorTokens(value as Record<string, unknown>, path));
    } else if (typeof value === 'string') {
      entries.push([path, value]);
    }
  }
  return entries;
}
