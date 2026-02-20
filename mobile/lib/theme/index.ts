/**
 * Public theme API surface.
 *
 * Components import from `@/lib/theme` — never from internal paths like
 * `@/lib/theme/colors` or `@/lib/theme/themes/nature`. This barrel
 * re-exports only the consumer-facing symbols.
 */

export type { ColorTokens } from './colors';
export type { BorderRadiusTokens, ShadowTokens, SpacingTokens } from './layout';
export { borderRadius, shadows, spacing } from './layout';
export type { ThemeDefinition, ThemeValue } from './theme-context';
export { ThemeProvider, useTheme } from './theme-context';
export { defaultThemeId, isThemeId, themes } from './themes';
export { natureTheme } from './themes/nature';
export type { FontSizeTokens, FontWeightTokens, TypographyTokens } from './typography';
export { fontSize, fontWeight, typography } from './typography';
