import { describe, expect, test } from 'vitest';
import { createTypography, fontSize, fontWeight, typography } from '../typography';

describe('fontSize', () => {
  test('provides all named sizes', () => {
    expect(fontSize.xs).toBe(12);
    expect(fontSize.sm).toBe(13);
    expect(fontSize.md).toBe(14);
    expect(fontSize.lg).toBe(15);
    expect(fontSize.xl).toBe(16);
    expect(fontSize['2xl']).toBe(18);
    expect(fontSize['3xl']).toBe(24);
  });

  test('all values are positive numbers', () => {
    for (const [name, value] of Object.entries(fontSize)) {
      expect(typeof value, `fontSize.${name} should be a number`).toBe('number');
      expect(value, `fontSize.${name} should be positive`).toBeGreaterThan(0);
    }
  });

  test('values are in ascending order', () => {
    const values = Object.values(fontSize);
    for (let i = 1; i < values.length; i++) {
      expect(values[i], 'fontSize values should ascend').toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('fontWeight', () => {
  test('provides all named weights', () => {
    expect(fontWeight.normal).toBe('400');
    expect(fontWeight.medium).toBe('500');
    expect(fontWeight.semibold).toBe('600');
    expect(fontWeight.bold).toBe('700');
  });

  test('all values are numeric strings', () => {
    for (const [name, value] of Object.entries(fontWeight)) {
      expect(typeof value, `fontWeight.${name} should be a string`).toBe('string');
      expect(Number(value), `fontWeight.${name} should parse as a number`).toBeGreaterThan(0);
    }
  });
});

describe('createTypography', () => {
  const result = createTypography();

  test('returns all preset names', () => {
    const expectedPresets = [
      'headingLarge',
      'headingMedium',
      'headingSmall',
      'bodyLarge',
      'bodyMedium',
      'bodySmall',
      'labelLarge',
      'labelMedium',
      'labelSmall',
      'caption',
    ];
    expect(Object.keys(result).sort()).toEqual(expectedPresets.sort());
  });

  test('every preset has fontSize and fontWeight', () => {
    for (const [name, preset] of Object.entries(result)) {
      expect(preset.fontSize, `${name}.fontSize should be defined`).toBeDefined();
      expect(preset.fontWeight, `${name}.fontWeight should be defined`).toBeDefined();
      expect(typeof preset.fontSize, `${name}.fontSize should be a number`).toBe('number');
      expect(typeof preset.fontWeight, `${name}.fontWeight should be a string`).toBe('string');
    }
  });

  test('heading presets use larger font sizes', () => {
    expect(result.headingLarge.fontSize).toBe(fontSize['3xl']);
    expect(result.headingMedium.fontSize).toBe(fontSize['2xl']);
    expect(result.headingSmall.fontSize).toBe(fontSize.xl);
  });

  test('body presets use standard font sizes', () => {
    expect(result.bodyLarge.fontSize).toBe(fontSize.xl);
    expect(result.bodyMedium.fontSize).toBe(fontSize.md);
    expect(result.bodySmall.fontSize).toBe(fontSize.sm);
  });

  test('label presets use semibold weight', () => {
    expect(result.labelLarge.fontWeight).toBe(fontWeight.semibold);
    expect(result.labelMedium.fontWeight).toBe(fontWeight.semibold);
    expect(result.labelSmall.fontWeight).toBe(fontWeight.semibold);
  });
});

describe('typography (default instance)', () => {
  test('is the same shape as createTypography output', () => {
    const fresh = createTypography();
    expect(Object.keys(typography).sort()).toEqual(Object.keys(fresh).sort());
  });

  test('has identical values to a fresh createTypography call', () => {
    const fresh = createTypography();
    expect(typography).toEqual(fresh);
  });
});
