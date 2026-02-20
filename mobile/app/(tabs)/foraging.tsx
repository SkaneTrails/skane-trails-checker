import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useForagingSpots, useForagingTypes } from '@/lib/hooks';
import {
  type BorderRadiusTokens,
  type ColorTokens,
  type SpacingTokens,
  useTheme,
} from '@/lib/theme';
import type { ForagingSpot } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SpotItem({
  spot,
  styles,
}: {
  spot: ForagingSpot;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.spotType}>{spot.type}</Text>
        <Text style={styles.spotMonth}>{spot.month}</Text>
      </View>
      {spot.notes ? <Text style={styles.notes}>{spot.notes}</Text> : null}
      <Text style={styles.coords}>
        📍 {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>
    </View>
  );
}

export default function ForagingScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius),
    [colors, spacing, borderRadius],
  );
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isLoading, error } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <Pressable
          style={[styles.monthChip, !selectedMonth && styles.monthChipActive]}
          onPress={() => setSelectedMonth(undefined)}
        >
          <Text style={[styles.monthText, !selectedMonth && styles.monthTextActive]}>All</Text>
        </Pressable>
        {MONTHS.map((m) => (
          <Pressable
            key={m}
            style={[styles.monthChip, selectedMonth === m && styles.monthChipActive]}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          >
            <Text style={[styles.monthText, selectedMonth === m && styles.monthTextActive]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading spots...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load foraging spots</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SpotItem spot={item} styles={styles} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            types && types.length > 0 ? (
              <View style={styles.typesRow}>
                {types.map((t) => (
                  <Text key={t.name} style={styles.typeTag}>
                    {t.icon} {t.name}
                  </Text>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No foraging spots found</Text>
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
    monthBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    monthChip: {
      paddingHorizontal: spacing['md-lg'],
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.tag.inactive.bg,
    },
    monthChipActive: {
      backgroundColor: colors.primary,
    },
    monthText: {
      fontSize: 13,
      color: colors.text.primary,
    },
    monthTextActive: {
      color: colors.text.inverse,
      fontWeight: '600',
    },
    list: {
      padding: spacing.lg,
      gap: spacing['md-lg'],
    },
    typesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    typeTag: {
      fontSize: 13,
      backgroundColor: colors.tag.foraging.bg,
      paddingHorizontal: spacing['md-lg'],
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.lg,
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    spotType: {
      fontSize: 15,
      fontWeight: '600',
    },
    spotMonth: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    notes: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: spacing.sm,
    },
    coords: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    error: {
      fontSize: 16,
      color: colors.error,
      fontWeight: 'bold',
    },
  });
