/**
 * Map layer toggle panel — glass floating control with mini toggle switches.
 *
 * Allows toggling visibility of map layers:
 * trails, foraging spots, places.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';

export interface MapLayer {
  id: string;
  label: string;
  icon: string;
  color: string;
  enabled: boolean;
}

interface LayerToggleProps {
  layers: MapLayer[];
  onToggle: (layerId: string) => void;
}

const TRACK_WIDTH = 32;
const TRACK_HEIGHT = 18;
const THUMB_SIZE = 14;
const THUMB_OFFSET = 2;

export const LayerToggle = ({ layers, onToggle }: LayerToggleProps) => {
  const { colors, shadows } = useTheme();
  const glass = glassCard(colors.glass);

  return (
    <View style={[styles.container, glass, shadows.card]}>
      {layers.map((layer) => (
        <Pressable
          key={layer.id}
          style={[styles.row, layer.enabled && { backgroundColor: colors.glass.activeHighlight }]}
          onPress={() => onToggle(layer.id)}
          accessibilityRole="switch"
          accessibilityState={{ checked: layer.enabled }}
          accessibilityLabel={layer.label}
        >
          <Text
            style={[
              styles.label,
              {
                color: layer.enabled ? colors.text.primary : colors.text.muted,
              },
            ]}
          >
            {layer.label}
          </Text>
          {/* Mini toggle switch */}
          <View
            style={[
              styles.track,
              {
                backgroundColor: layer.enabled ? colors.primary : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.thumb,
                {
                  backgroundColor: colors.surface,
                  transform: [{ translateX: layer.enabled ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2 : 0 }],
                },
              ]}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    minWidth: 150,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: THUMB_OFFSET,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
});
