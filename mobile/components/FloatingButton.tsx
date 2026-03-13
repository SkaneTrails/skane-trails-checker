/**
 * Glass pill-shaped floating button for map actions.
 *
 * Used for "Navigate", "Share", "Edit" action row pattern
 * and standalone floating action buttons.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';

interface FloatingButtonProps {
  icon?: string;
  label: string;
  onPress: () => void;
  variant?: 'glass' | 'primary';
}

export const FloatingButton = ({
  icon,
  label,
  onPress,
  variant = 'glass',
}: FloatingButtonProps) => {
  const { colors, shadows } = useTheme();

  const isPrimary = variant === 'primary';
  const bgStyle = isPrimary ? { backgroundColor: colors.primary } : glassPill(colors.glass);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        bgStyle,
        shadows.card,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text
        style={[styles.label, { color: isPrimary ? colors.text.inverse : colors.text.primary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  icon: {
    fontSize: fontSize.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
});
