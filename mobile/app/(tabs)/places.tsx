import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaceCategories, usePlaces } from '@/lib/hooks';
import {
  type BorderRadiusTokens,
  type ColorTokens,
  type SpacingTokens,
  useTheme,
} from '@/lib/theme';
import type { Place } from '@/lib/types';

function PlaceItem({ place, styles }: { place: Place; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.card}>
      <Text style={styles.placeName}>{place.name}</Text>
      {place.city ? (
        <Text style={styles.description} numberOfLines={1}>
          {place.city}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <Text style={styles.coords}>
          📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </Text>
        {place.categories.length > 0 && (
          <View style={styles.categoriesRow}>
            {place.categories.map((cat) => (
              <Text key={cat.slug} style={styles.categoryTag}>
                {cat.icon} {cat.name}
              </Text>
            ))}
          </View>
        )}
      </View>
      {place.weburl ? (
        <Text style={styles.website} numberOfLines={1}>
          🔗 {place.weburl}
        </Text>
      ) : null}
    </View>
  );
}

export default function PlacesScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius),
    [colors, spacing, borderRadius],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { data: places, isLoading, error } = usePlaces(selectedCategory);
  const { data: categories } = usePlaceCategories();

  const categoryEntries = categories ? Object.entries(categories) : [];

  return (
    <View style={styles.container}>
      {categoryEntries.length > 0 && (
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>
              All
            </Text>
          </Pressable>
          {categoryEntries.map(([slug, cat]) => (
            <Pressable
              key={slug}
              style={[styles.filterChip, selectedCategory === slug && styles.filterChipActive]}
              onPress={() => setSelectedCategory(slug === selectedCategory ? undefined : slug)}
            >
              <Text
                style={[styles.filterText, selectedCategory === slug && styles.filterTextActive]}
              >
                {cat.icon} {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading places...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load places</Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => <PlaceItem place={item} styles={styles} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No places found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (
  colors: ColorTokens,
  spacing: SpacingTokens,
  borderRadius: BorderRadiusTokens,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
    },
    filterBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterChip: {
      paddingHorizontal: spacing['md-lg'],
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.tag.inactive.bg,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: 13,
      color: colors.text.primary,
    },
    filterTextActive: {
      color: colors.text.inverse,
      fontWeight: '600',
    },
    list: {
      padding: spacing.lg,
      gap: spacing['md-lg'],
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing['lg-xl'],
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    placeName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    description: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: spacing.md,
    },
    cardMeta: {
      gap: spacing.sm,
    },
    coords: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    categoriesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryTag: {
      fontSize: 12,
      backgroundColor: colors.tag.place.bg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing['2xs'],
      borderRadius: borderRadius.md,
      color: colors.tag.place.text,
    },
    website: {
      fontSize: 13,
      color: colors.text.link,
      marginTop: spacing.sm,
    },
    error: {
      fontSize: 16,
      color: colors.error,
      fontWeight: 'bold',
    },
  });
