/**
 * Translucent glass card with backdrop blur.
 *
 * Web-only: uses CSS backdrop-filter for frosted glass effect.
 * Falls back to semi-transparent background on unsupported browsers.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { borderRadius, spacing, useTheme } from '@/lib/theme';
import { glassCard, glassPill, glassSheet } from '@/lib/theme/styles';

type GlassIntensity = 'light' | 'medium' | 'heavy';

interface GlassCardProps {
  children: ReactNode;
  intensity?: GlassIntensity;
  style?: ViewStyle;
}

const glassFactory = {
  light: glassPill,
  medium: glassCard,
  heavy: glassSheet,
} as const;

export const GlassCard = ({ children, intensity = 'medium', style }: GlassCardProps) => {
  const { colors, shadows } = useTheme();
  const glassStyle = glassFactory[intensity](colors.glass);

  return <View style={[styles.base, glassStyle, shadows.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
});
