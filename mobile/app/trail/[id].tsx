import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTrail, useTrailDetails, useUpdateTrail } from '@/lib/hooks';
import {
  type BorderRadiusTokens,
  type ColorTokens,
  type SpacingTokens,
  useTheme,
} from '@/lib/theme';

export default function TrailDetailScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius),
    [colors, spacing, borderRadius],
  );
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trail, isLoading: trailLoading } = useTrail(id);
  const { data: details, isLoading: detailsLoading } = useTrailDetails(id);
  const updateTrail = useUpdateTrail();

  if (trailLoading || detailsLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading trail...</Text>
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Trail not found</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const toggleStatus = () => {
    if (!id) return;
    const newStatus = trail.status === 'Explored!' ? 'To Explore' : 'Explored!';
    updateTrail.mutate({ id, data: { status: newStatus } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{trail.name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{trail.length_km.toFixed(1)} km</Text>
        </View>
        {trail.elevation_gain != null && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Elevation Gain</Text>
            <Text style={styles.statValue}>{Math.round(trail.elevation_gain)} m</Text>
          </View>
        )}
        {trail.elevation_loss != null && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Elevation Loss</Text>
            <Text style={styles.statValue}>{Math.round(trail.elevation_loss)} m</Text>
          </View>
        )}
        {trail.difficulty && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Difficulty</Text>
            <Text style={styles.statValue}>{trail.difficulty}</Text>
          </View>
        )}
      </View>

      <View style={styles.statusSection}>
        <Pressable
          style={[
            styles.statusButton,
            trail.status === 'Explored!' ? styles.exploredButton : styles.toExploreButton,
          ]}
          onPress={toggleStatus}
          disabled={updateTrail.isPending}
        >
          <Text style={styles.statusButtonText}>
            {updateTrail.isPending
              ? 'Updating...'
              : trail.status === 'Explored!'
                ? '✅ Explored!'
                : '🔴 Mark as Explored'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Info</Text>
        <Text style={styles.infoText}>Source: {trail.source.replace(/_/g, ' ')}</Text>
        {trail.last_updated && (
          <Text style={styles.infoText}>
            Last updated: {new Date(trail.last_updated).toLocaleDateString()}
          </Text>
        )}
        {trail.activity_date && (
          <Text style={styles.infoText}>
            Activity date: {new Date(trail.activity_date).toLocaleDateString()}
          </Text>
        )}
        {trail.activity_type && (
          <Text style={styles.infoText}>Activity: {trail.activity_type}</Text>
        )}
        {details && (
          <Text style={styles.infoText}>Track points: {details.coordinates_full.length}</Text>
        )}
      </View>
    </ScrollView>
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
    content: {
      padding: spacing.xl,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: spacing.xl,
      color: colors.primary,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      marginBottom: spacing['2xl'],
    },
    stat: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing['lg-xl'],
      minWidth: 100,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    statLabel: {
      fontSize: 12,
      color: colors.text.muted,
      marginBottom: spacing.xs,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    statusSection: {
      marginBottom: spacing['2xl'],
    },
    statusButton: {
      padding: spacing.xl,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    exploredButton: {
      backgroundColor: colors.status.explored.bg,
    },
    toExploreButton: {
      backgroundColor: colors.status.toExplore.bg,
    },
    statusButtonText: {
      fontSize: 18,
      fontWeight: '600',
    },
    infoSection: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: spacing['md-lg'],
      color: colors.text.primary,
    },
    infoText: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: spacing.sm,
    },
    error: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.error,
      marginBottom: spacing.lg,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing['md-lg'],
      borderRadius: borderRadius.sm,
    },
    buttonText: {
      color: colors.text.inverse,
      fontWeight: '600',
    },
  });
