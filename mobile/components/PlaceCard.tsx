/**
 * Place floating card — display only.
 *
 * Shows name, city, category tags, and web URL.
 * Uses theme tokens for all visual properties.
 */

import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, spacing, useTheme } from '@/lib/theme';
import type { Place } from '@/lib/types';
import { MapInfoCard } from './MapInfoCard';
import { PlaceCategoryIcon } from './PlaceCategoryIcon';

interface PlaceCardProps {
  place: Place;
  onClose: () => void;
}

export const PlaceCard = ({ place, onClose }: PlaceCardProps) => {
  const { colors } = useTheme();

  return (
    <MapInfoCard title={place.name} onClose={onClose}>
      {!!place.city && (
        <Text style={[styles.cityText, { color: colors.text.secondary }]}>
          {place.city}
        </Text>
      )}

      {place.categories.length > 0 && (
        <View style={styles.tagRow}>
          {place.categories.map((cat) => (
            <View
              key={cat.slug}
              style={[styles.tag, { backgroundColor: colors.tag.placeBg }]}
            >
              <PlaceCategoryIcon slug={cat.slug} size={12} strokeWidth={2} />
              <Text style={{ color: colors.tag.placeText, fontSize: fontSize.sm }}>
                {cat.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!!place.weburl && (
        <Text style={[styles.urlText, { color: colors.primary }]} numberOfLines={1}>
          {place.weburl}
        </Text>
      )}
    </MapInfoCard>
  );
};

const styles = StyleSheet.create({
  cityText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  urlText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
