import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout } from '@/components';
import { usePlaceCategories, usePlaces } from '@/lib/hooks';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Place } from '@/lib/types';

function PlaceItem({ place }: { place: Place }) {
  const { colors } = useTheme();

  return (
    <ContentCard>
      <Text style={[styles.placeName, { color: colors.text.primary }]}>{place.name}</Text>
      {place.city ? (
        <Text style={[styles.description, { color: colors.text.secondary }]} numberOfLines={1}>
          {place.city}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <Text style={[styles.coords, { color: colors.text.muted }]}>
          📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </Text>
        {place.categories.length > 0 && (
          <View style={styles.categoriesRow}>
            {place.categories.map((cat) => (
              <Text
                key={cat.slug}
                style={[
                  styles.categoryTag,
                  { backgroundColor: colors.tag.placeBg, color: colors.tag.placeText },
                ]}
              >
                {cat.icon} {cat.name}
              </Text>
            ))}
          </View>
        )}
      </View>
      {place.weburl ? (
        <Text style={[styles.website, { color: colors.primary }]} numberOfLines={1}>
          🔗 {place.weburl}
        </Text>
      ) : null}
    </ContentCard>
  );
}

export default function PlacesScreen() {
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { data: places, isLoading, error } = usePlaces(selectedCategory);
  const { data: categories } = usePlaceCategories();

  const categoryEntries = categories ? Object.entries(categories) : [];

  return (
    <ScreenLayout>
      {categoryEntries.length > 0 && (
        <View
          style={[
            styles.filterBar,
            { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
          ]}
        >
          <Chip
            label="All"
            selected={!selectedCategory}
            onPress={() => setSelectedCategory(undefined)}
          />
          {categoryEntries.map(([slug, cat]) => (
            <Chip
              key={slug}
              label={`${cat.icon} ${cat.name}`}
              selected={selectedCategory === slug}
              onPress={() => setSelectedCategory(slug === selectedCategory ? undefined : slug)}
            />
          ))}
        </View>
      )}

      {isLoading ? (
        <EmptyState emoji="⏳" title="Loading places..." />
      ) : error ? (
        <EmptyState emoji="⚠️" title="Failed to load places" />
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => <PlaceItem place={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState emoji="📍" title="No places found" />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm - 2,
    borderBottomWidth: 1,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  placeName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  cardMeta: {
    gap: spacing.sm - 2,
  },
  coords: {
    fontSize: fontSize.xs,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
  },
  categoryTag: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
  },
  website: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm - 2,
  },
});
