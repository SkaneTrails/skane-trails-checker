import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ScreenLayout, TrailCard } from '@/components';
import { TrailMap } from '@/components/TrailMap';
import { useTrails, useUpdateTrail } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, spacing, useTheme } from '@/lib/theme';
import type { Trail, TrailUpdate } from '@/lib/types';

export default function MapScreen() {
  const { data: trails, isFetching, error } = useTrails();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const updateTrail = useUpdateTrail();

  if (Platform.OS !== 'web') {
    return (
      <ScreenLayout>
        <EmptyState
          emoji="🗺️"
          title={t('map.webOnly')}
          subtitle={t('map.useTrailsTab')}
        />
      </ScreenLayout>
    );
  }

  const handleViewDetails = (trail: Trail) => {
    router.push(`/trail/${trail.trail_id}`);
  };

  const handleUpdate = (trailId: string, data: TrailUpdate) => {
    updateTrail.mutate({ id: trailId, data }, {
      onSuccess: (updated) => {
        setSelectedTrail(updated);
      },
    });
  };

  return (
    <ScreenLayout>
      <View style={styles.container}>
        <TrailMap trails={trails ?? []} onTrailSelect={setSelectedTrail} />
        {selectedTrail && (
          <View style={styles.cardOverlay} pointerEvents="box-none">
            <TrailCard
              trail={selectedTrail}
              onViewDetails={handleViewDetails}
              onClose={() => setSelectedTrail(null)}
              onUpdate={handleUpdate}
              isUpdating={updateTrail.isPending}
            />
          </View>
        )}
        {isFetching && (
          <View style={[styles.spinner, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator size="small" color={colors.overlayText} />
          </View>
        )}
        {error && !trails?.length && (
          <View style={styles.overlay}>
            <Text
              style={[
                styles.overlayText,
                { backgroundColor: colors.overlay, color: colors.overlayText },
              ]}
            >
              {t('map.couldNotConnect')}
            </Text>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  spinner: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.pill,
    padding: spacing.sm,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  overlayText: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    fontSize: fontSize.md,
    overflow: 'hidden',
  },
});
