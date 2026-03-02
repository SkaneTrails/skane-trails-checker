/**
 * Labeled text input field.
 */

import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

export function FormField({ label, ...inputProps }: FormFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text.primary,
          },
        ]}
        placeholderTextColor={colors.text.muted}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.lg,
  },
});
