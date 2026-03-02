/**
 * Themed pressable button.
 *
 * Supports primary, secondary, and danger variants.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const { colors } = useTheme();

  const bgColor = {
    primary: colors.primary,
    secondary: colors.surface,
    danger: colors.error,
  }[variant];

  const textColor = {
    primary: colors.text.inverse,
    secondary: colors.primary,
    danger: colors.text.inverse,
  }[variant];

  const borderColor = variant === 'secondary' ? colors.primary : undefined;

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: bgColor },
        borderColor ? { borderWidth: 1, borderColor } : undefined,
        disabled && styles.disabled,
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
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});
