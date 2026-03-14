import { useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout } from '@/components';
import { PlaceCategoryIcon } from '@/components/PlaceCategoryIcon';
import { usePlaceCategories, usePlaces } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/lib/settings-context';
import { borderRadius, blur, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import type { Place } from '@/lib/types';

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
      {place.weburl ? (
        <Text style={[styles.website, { color: colors.primary }]} numberOfLines={1}>
          {place.weburl}
        </Text>
      ) : null}
    </ContentCard>
  );
}

export default function PlacesScreen() {
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
    <ScreenLayout title={t('tabs.places')}>
      {/* Summary bar */}
      <View
        style={[
          styles.summaryBar,
          { borderColor: colors.glass.border },
          Platform.OS === 'web' &&
            ({
              backgroundColor: colors.glass.background,
              backdropFilter: `blur(${blur.md}px)`,
              WebkitBackdropFilter: `blur(${blur.md}px)`,
            } as any),
        ]}
      >
        <Text style={[styles.summaryText, { color: colors.text.primary }]}>
          {filteredPlaces.length} {t('places.places')}
        </Text>
      </View>

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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 100,
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
    flex: 1,
    marginRight: spacing.sm,
  },
  placeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  placeDetails: {
    marginLeft: spacing.lg + spacing.sm,
    gap: spacing.xs,
  },
  cityText: {
    fontSize: fontSize.md,
  },
  coords: {
    fontSize: fontSize.xs,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  categoryTagText: {
    fontSize: fontSize.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  filterChipText: {
    fontSize: fontSize.sm,
  },
  website: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    marginLeft: spacing.lg + spacing.sm,
  },
});
