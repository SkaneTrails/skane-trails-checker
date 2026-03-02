/**
 * Filter/toggle chip.
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
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.chip.activeBg : colors.chip.bg,
        },
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.lg,
  },
  text: {
    fontSize: fontSize.sm,
  },
});
