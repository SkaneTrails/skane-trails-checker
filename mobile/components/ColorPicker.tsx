/**
 * Color picker — 10 circular swatches for trail line color selection.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '@/lib/theme';
import { TRAIL_COLORS } from '@/lib/trail-colors';

interface ColorPickerProps {
  selected: string | null | undefined;
  onSelect: (hex: string) => void;
}

const SWATCH_SIZE = 32;

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {TRAIL_COLORS.map((hex) => {
        const isSelected = selected === hex;
        const needsBorder = hex === '#FFFFFF' || hex === '#ECC94B';
        return (
          <Pressable
            key={hex}
            onPress={() => onSelect(hex)}
            style={[
              styles.swatch,
              { backgroundColor: hex },
              needsBorder && { borderWidth: 1, borderColor: colors.border },
              isSelected && styles.selectedSwatch,
              isSelected && { borderColor: colors.primary },
            ]}
            accessibilityLabel={hex}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
  },
  selectedSwatch: {
    borderWidth: 3,
  },
});
