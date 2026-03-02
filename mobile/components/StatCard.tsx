/**
 * Stat display card (distance, elevation, etc.).
 */

import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

interface StatCardProps {
  label: string;
  value: string;
}

export function StatCard({ label, value }: StatCardProps) {
  const { colors, shadows } = useTheme();

  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }, shadows.subtle]}>
      <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    borderRadius: borderRadius.md,
    padding: spacing.lg - 2,
    minWidth: 100,
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
});
