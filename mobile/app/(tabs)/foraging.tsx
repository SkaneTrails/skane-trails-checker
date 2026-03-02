import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout } from '@/components';
import { useForagingSpots, useForagingTypes } from '@/lib/hooks';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SpotItem({ spot }: { spot: ForagingSpot }) {
  const { colors } = useTheme();

  return (
    <ContentCard>
      <View style={styles.cardHeader}>
        <Text style={[styles.spotType, { color: colors.text.primary }]}>{spot.type}</Text>
        <Text style={[styles.spotMonth, { color: colors.text.secondary }]}>{spot.month}</Text>
      </View>
      {spot.notes ? (
        <Text style={[styles.notes, { color: colors.text.secondary }]}>{spot.notes}</Text>
      ) : null}
      <Text style={[styles.coords, { color: colors.text.muted }]}>
        📍 {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>
    </ContentCard>
  );
}

export default function ForagingScreen() {
  const { colors } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isLoading, error } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();

  return (
    <ScreenLayout>
      <View
        style={[
          styles.monthBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
        ]}
      >
        <Chip label="All" selected={!selectedMonth} onPress={() => setSelectedMonth(undefined)} />
        {MONTHS.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={selectedMonth === m}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          />
        ))}
      </View>

      {isLoading ? (
        <EmptyState emoji="⏳" title="Loading spots..." />
      ) : error ? (
        <EmptyState emoji="⚠️" title="Failed to load foraging spots" />
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SpotItem spot={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            types && types.length > 0 ? (
              <View style={styles.typesRow}>
                {types.map((t) => (
                  <Text
                    key={t.name}
                    style={[
                      styles.typeTag,
                      {
                        backgroundColor: colors.tag.foragingBg,
                        color: colors.tag.foragingText,
                      },
                    ]}
                  >
                    {t.icon} {t.name}
                  </Text>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState emoji="🍄" title="No foraging spots found" />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  monthBar: {
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
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeTag: {
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg - 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm - 2,
  },
  spotType: {
    fontSize: fontSize.lg - 1,
    fontWeight: fontWeight.semibold,
  },
  spotMonth: {
    fontSize: fontSize.sm,
  },
  notes: {
    fontSize: fontSize.md,
    marginBottom: spacing.sm - 2,
  },
  coords: {
    fontSize: fontSize.xs,
  },
});
