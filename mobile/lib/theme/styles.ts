/**
 * Composed style helpers for glassmorphism effects.
 *
 * Web-targeted: uses CSS backdrop-filter via style objects.
 * Fallback: opaque backgrounds for browsers without support.
 */

import type { ViewStyle } from 'react-native';
import type { ColorTokens } from './colors';
import { blur, borderRadius } from './layout';
import type { ShadowTokens } from './layout';

type WebStyle = ViewStyle & {
  backdropFilter?: string;
  WebkitBackdropFilter?: string;
};

export function glassCard(glass: ColorTokens['glass']): WebStyle {
  return {
    backgroundColor: glass.background,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: borderRadius.lg,
    backdropFilter: `blur(${blur.md}px)`,
    WebkitBackdropFilter: `blur(${blur.md}px)`,
  };
}

export function glassPill(glass: ColorTokens['glass']): WebStyle {
  return {
    backgroundColor: glass.background,
    borderWidth: 1,
    borderColor: glass.borderSubtle,
    borderRadius: borderRadius.full,
    backdropFilter: `blur(${blur.sm}px)`,
    WebkitBackdropFilter: `blur(${blur.sm}px)`,
  };
}

export function glassSheet(glass: ColorTokens['glass']): WebStyle {
  return {
    backgroundColor: glass.background,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: borderRadius.xl,
    backdropFilter: `blur(${blur.lg}px)`,
    WebkitBackdropFilter: `blur(${blur.lg}px)`,
  };
}

export function glassDark(glass: ColorTokens['glass']): WebStyle {
  return {
    backgroundColor: glass.backgroundDark,
    borderWidth: 1,
    borderColor: glass.borderSubtle,
    borderRadius: borderRadius.lg,
    backdropFilter: `blur(${blur.md}px)`,
    WebkitBackdropFilter: `blur(${blur.md}px)`,
  };
}

/** Frosted light-gray surface for screen cards and settings panels. */
export function glassSurface(glass: ColorTokens['glass']): WebStyle {
  return {
    backgroundColor: glass.surface,
    backdropFilter: `blur(${blur.lg}px)`,
    WebkitBackdropFilter: `blur(${blur.lg}px)`,
  };
}

/** Convert RN shadow tokens to a CSS box-shadow string. */
export function cssShadow(shadows: ShadowTokens, level: keyof ShadowTokens): string {
  const s = shadows[level];
  const main = `${s.shadowOffset.width}px ${s.shadowOffset.height}px ${s.shadowRadius}px ${s.shadowColor}`;
  if (level === 'elevated' || level === 'card') {
    const sub = shadows.subtle;
    return `${main}, ${sub.shadowOffset.width}px ${sub.shadowOffset.height}px ${sub.shadowRadius}px ${sub.shadowColor}`;
  }
  return main;
}
