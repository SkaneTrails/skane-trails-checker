import { describe, expect, test } from 'vitest';
import { borderRadius, shadows, spacing } from '../layout';

describe('spacing', () => {
  test('provides a complete named scale', () => {
    expect(spacing['2xs']).toBe(2);
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(6);
    expect(spacing.md).toBe(8);
    expect(spacing['md-lg']).toBe(10);
    expect(spacing.lg).toBe(12);
    expect(spacing['lg-xl']).toBe(14);
    expect(spacing.xl).toBe(16);
    expect(spacing['2xl']).toBe(20);
    expect(spacing['3xl']).toBe(24);
  });

  test('all values are positive integers', () => {
    for (const [name, value] of Object.entries(spacing)) {
      expect(Number.isInteger(value), `spacing.${name} should be an integer`).toBe(true);
      expect(value, `spacing.${name} should be positive`).toBeGreaterThan(0);
    }
  });

  test('values are in ascending order', () => {
    const values = Object.values(spacing);
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `spacing values should ascend`).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('borderRadius', () => {
  test('provides a complete named scale', () => {
    expect(borderRadius.xs).toBe(4);
    expect(borderRadius.sm).toBe(8);
    expect(borderRadius.md).toBe(10);
    expect(borderRadius.lg).toBe(12);
    expect(borderRadius.xl).toBe(16);
    expect(borderRadius.full).toBe(9999);
  });

  test('all values are positive integers', () => {
    for (const [name, value] of Object.entries(borderRadius)) {
      expect(Number.isInteger(value), `borderRadius.${name} should be an integer`).toBe(true);
      expect(value, `borderRadius.${name} should be positive`).toBeGreaterThan(0);
    }
  });

  test('non-full values are in ascending order', () => {
    const entries = Object.entries(borderRadius).filter(([k]) => k !== 'full');
    const values = entries.map(([, v]) => v);
    for (let i = 1; i < values.length; i++) {
      expect(values[i], 'borderRadius values should ascend').toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('shadows', () => {
  test('provides all preset levels', () => {
    expect(shadows.none).toBeDefined();
    expect(shadows.sm).toBeDefined();
    expect(shadows.md).toBeDefined();
    expect(shadows.lg).toBeDefined();
  });

  test('each preset has a boxShadow string', () => {
    for (const [name, value] of Object.entries(shadows)) {
      expect(typeof value.boxShadow, `shadows.${name}.boxShadow should be string`).toBe('string');
      expect(
        value.boxShadow.length,
        `shadows.${name}.boxShadow should be non-empty`,
      ).toBeGreaterThan(0);
    }
  });

  test('none preset is transparent', () => {
    expect(shadows.none.boxShadow).toContain('transparent');
  });
});
