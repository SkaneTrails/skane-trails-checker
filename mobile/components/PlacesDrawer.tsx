/**
 * Places list drawer — category filter + place list.
 *
 * Accessible from the hamburger menu. Shows places with
 * category filtering, same data as the old places tab.
 */

import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Chip } from '@/components/Chip';
import { ContentCard } from '@/components/ContentCard';
import { DrawerOverlay } from '@/components/DrawerOverlay';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCategoryIcon } from '@/components/PlaceCategoryIcon';
import { usePlaceCategories, usePlaces } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/lib/settings-context';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Place } from '@/lib/types';

interface PlacesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function PlaceItem({ place }: { place: Place }) {
  const { colors } = useTheme();

  return (
    <ContentCard>
      <View style={styles.placeHeader}>
        <View style={styles.placeTitleRow}>
          <View style={[styles.placeIndicator, { backgroundColor: colors.explored }]} />
          <Text style={[styles.placeName, { color: colors.text.primary }]}>{place.name}</Text>
        </View>
        {place.categories.length > 0 && (
          <View style={styles.categoriesRow}>
            {place.categories.map((cat) => (
              <View
                key={cat.slug}
                style={[styles.categoryTag, { backgroundColor: colors.tag.placeBg }]}
              >
                <PlaceCategoryIcon slug={cat.slug} size={12} strokeWidth={2} />
                <Text style={[styles.categoryTagText, { color: colors.tag.placeText }]}>
                  {cat.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.placeDetails}>
        {place.city ? (
          <Text style={[styles.cityText, { color: colors.text.secondary }]} numberOfLines={1}>
            {place.city}
          </Text>
        ) : null}
        <Text style={[styles.coords, { color: colors.text.muted }]}>
          {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </Text>
      </View>
    </ContentCard>
  );
}

export const PlacesDrawer = ({ isOpen, onClose }: PlacesDrawerProps) => {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { enabledPlaceCategories, togglePlaceCategory, setEnabledPlaceCategories } = useSettings();
  const { data: places, isLoading, error } = usePlaces();
  const { data: categories } = usePlaceCategories();

  const categoryEntries = categories ? Object.entries(categories) : [];
  const allEnabled = categoryEntries.length > 0 && categoryEntries.every(([slug]) => enabledPlaceCategories.includes(slug));

  const filteredPlaces = useMemo(
    () =>
      (places ?? []).filter((p) =>
        p.categories.some((c) => enabledPlaceCategories.includes(c.slug)),
      ),
    [places, enabledPlaceCategories],
  );

  const handleToggleAll = () => {
    if (allEnabled) {
      setEnabledPlaceCategories([]);
    } else {
      setEnabledPlaceCategories(categoryEntries.map(([slug]) => slug));
    }
  };

  return (
    <DrawerOverlay isOpen={isOpen} title={t('tabs.places')} onClose={onClose}>
      {/* Summary */}
      <Text style={[styles.summaryText, { color: colors.text.primary }]}>
        {filteredPlaces.length} {t('places.places')}
      </Text>

      {/* Category filter */}
      {categoryEntries.length > 0 && (
        <View style={styles.filterBar}>
          <Chip
            label={t('common.all')}
            selected={allEnabled}
            onPress={handleToggleAll}
          />
          {categoryEntries.map(([slug, cat]) => {
            const isSelected = enabledPlaceCategories.includes(slug);
            return (
              <Pressable
                key={slug}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.chip.activeBg : colors.chip.bg,
                    borderColor: isSelected ? colors.chip.activeBg : colors.glass.borderSubtle,
                  },
                  isSelected && shadows.subtle,
                ]}
                onPress={() => togglePlaceCategory(slug)}
              >
                <PlaceCategoryIcon
                  slug={slug}
                  size={14}
                  strokeWidth={1.8}
                  color={isSelected ? colors.chip.activeText : undefined}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected ? colors.chip.activeText : colors.chip.text,
                      fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                    },
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <EmptyState title={t('places.loadingPlaces')} />
      ) : error ? (
        <EmptyState title={t('places.failedToLoad')} />
      ) : (
        <FlatList
          data={filteredPlaces}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => <PlaceItem place={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t('places.noPlacesFound')} />}
        />
      )}
    </DrawerOverlay>
  );
};

const styles = StyleSheet.create({
  summaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: fontSize.xs,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  placeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeIndicator: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  placeName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryTagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  placeDetails: {
    gap: spacing.xs,
  },
  cityText: {
    fontSize: fontSize.sm,
  },
  coords: {
    fontSize: fontSize.xs,
  },
});
