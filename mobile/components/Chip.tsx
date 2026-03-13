/**
 * Filter/toggle chip with glass inactive state.
 *
 * Used for month filters, category filters, status filters.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, shadows } = useTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.chip.activeBg : colors.chip.bg,
          borderColor: selected ? colors.chip.activeBg : colors.glass.borderSubtle,
        },
        selected && shadows.subtle,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? colors.chip.activeText : colors.chip.text,
            fontWeight: selected ? fontWeight.semibold : fontWeight.normal,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: fontSize.sm,
  },
});
