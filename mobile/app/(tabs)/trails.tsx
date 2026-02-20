import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTrails } from '@/lib/hooks';
import {
  type BorderRadiusTokens,
  type ColorTokens,
  type SpacingTokens,
  useTheme,
} from '@/lib/theme';
import type { Trail } from '@/lib/types';

function TrailItem({ trail, styles }: { trail: Trail; styles: ReturnType<typeof createStyles> }) {
  const router = useRouter();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/trail/${trail.trail_id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.trailName} numberOfLines={1}>
          {trail.name}
        </Text>
        <View
          style={[
            styles.statusBadge,
            trail.status === 'Explored!' ? styles.explored : styles.toExplore,
          ]}
        >
          <Text style={styles.statusText}>{trail.status}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>📏 {trail.length_km.toFixed(1)} km</Text>
        {trail.difficulty && <Text style={styles.metaText}>⛰️ {trail.difficulty}</Text>}
        <Text style={styles.metaText}>📂 {trail.source.replace(/_/g, ' ')}</Text>
      </View>
    </Pressable>
  );
}

export default function TrailsScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius),
    [colors, spacing, borderRadius],
  );
  const { data: trails, isLoading, error, refetch } = useTrails();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading trails...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load trails</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const explored = trails?.filter((t) => t.status === 'Explored!').length ?? 0;
  const total = trails?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          🥾 {explored} / {total} explored
        </Text>
      </View>
      <FlatList
        data={trails}
        keyExtractor={(item) => item.trail_id}
        renderItem={({ item }) => <TrailItem trail={item} styles={styles} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No trails found</Text>
          </View>
        }
      />
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
    summary: {
      backgroundColor: colors.primary,
      padding: spacing.lg,
      alignItems: 'center',
    },
    summaryText: {
      color: colors.text.inverse,
      fontSize: 16,
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    trailName: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      marginRight: spacing.md,
    },
    statusBadge: {
      paddingHorizontal: spacing['md-lg'],
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.lg,
    },
    explored: {
      backgroundColor: colors.status.explored.bg,
    },
    toExplore: {
      backgroundColor: colors.status.toExplore.bg,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    cardMeta: {
      flexDirection: 'row',
      gap: spacing.xl,
    },
    metaText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    error: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.error,
      marginBottom: spacing.lg,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing['md-lg'],
      borderRadius: borderRadius.sm,
    },
    retryText: {
      color: colors.text.inverse,
      fontWeight: '600',
    },
  });
