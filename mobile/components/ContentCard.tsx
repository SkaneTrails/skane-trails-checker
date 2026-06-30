/**
 * Card with soft shadow for list items.
 *
 * Supports optional glass variant for translucent surfaces.
 */

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { borderRadius, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';

interface ContentCardProps {
  children: ReactNode;
  glass?: boolean;
  style?: ViewStyle;
}

export function ContentCard({ children, glass = false, style }: ContentCardProps) {
  const { colors, shadows } = useTheme();

  const bg = glass ? glassCard(colors.glass) : { backgroundColor: colors.surface };

  // On web, add subtle glass border for depth
  const webBorder =
    Platform.OS === 'web' && !glass
      ? { borderWidth: 1, borderColor: colors.glass.border }
      : undefined;

  return <View style={[styles.card, bg, shadows.card, webBorder, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
});
