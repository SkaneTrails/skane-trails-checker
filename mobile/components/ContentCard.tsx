/**
 * Card with elevation shadow for list items.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { borderRadius, spacing, useTheme } from '@/lib/theme';

interface ContentCardProps {
  children: ReactNode;
}

export function ContentCard({ children }: ContentCardProps) {
  const { colors, shadows } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadows.card]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.lg - 2,
  },
});
