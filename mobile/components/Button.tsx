/**
 * Themed pressable button.
 *
 * Supports primary, secondary, danger, and glass variants.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'glass';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  pill?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  pill = false,
}: ButtonProps) {
  const { colors } = useTheme();

  const isGlass = variant === 'glass';

  const bgColor = {
    primary: colors.primary,
    secondary: colors.surface,
    danger: colors.surface,
    glass: undefined,
  }[variant];

  const textColor = {
    primary: colors.text.inverse,
    secondary: colors.primary,
    danger: colors.error,
    glass: colors.text.primary,
  }[variant];

  const borderColor =
    variant === 'secondary' ? colors.border : variant === 'danger' ? colors.error : undefined;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pill && styles.pill,
        isGlass ? glassPill(colors.glass) : { backgroundColor: bgColor },
        borderColor ? { borderWidth: 1, borderColor } : undefined,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: borderRadius.full,
  },
  text: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
