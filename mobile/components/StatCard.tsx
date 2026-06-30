/**
 * Stat display card (distance, elevation, etc.).
 */

import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';

interface StatCardProps {
  label: string;
  value: string;
  glass?: boolean;
}

export function StatCard({ label, value, glass = false }: StatCardProps) {
  const { colors, shadows } = useTheme();

  const bg = glass ? glassCard(colors.glass) : { backgroundColor: colors.surface };

  return (
    <View style={[styles.stat, bg, shadows.subtle]}>
      <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
});
