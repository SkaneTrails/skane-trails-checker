import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout } from '@/components';
import { AddSpotForm } from '@/components/AddSpotForm';
import { foragingColorMap } from '@/lib/foraging-colors';
import { useCreateForagingSpot, useForagingSpots, useForagingTypes } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, blur, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingSpotCreate } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SpotItem({ spot, typeColor }: { spot: ForagingSpot; typeColor: string }) {
  const { colors } = useTheme();

  return (
    <ContentCard>
      <View style={styles.spotHeader}>
        <View style={styles.spotTitleRow}>
          <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />
          <Text style={[styles.spotName, { color: colors.text.primary }]}>{spot.type}</Text>
        </View>
        <Text
          style={[
            styles.monthTag,
            { backgroundColor: colors.tag.foragingBg, color: colors.tag.foragingText },
          ]}
        >
          {spot.month}
        </Text>
      </View>
      {spot.notes ? (
        <Text style={[styles.spotNotes, { color: colors.text.secondary }]} numberOfLines={2}>
          {spot.notes}
        </Text>
      ) : null}
      <Text style={[styles.coords, { color: colors.text.muted }]}>
        {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>
    </ContentCard>
  );
}

export default function ForagingScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isLoading, isFetching, error, refetch } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();
  const createSpot = useCreateForagingSpot();
  const colorMap = foragingColorMap(types ?? []);

  const [showAddForm, setShowAddForm] = useState(false);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { enableHighAccuracy: true },
    );
  }, []);

  const handleAddSpot = useCallback(
    (data: ForagingSpotCreate) => {
      createSpot.mutate(data, {
        onSuccess: () => {
          setShowAddForm(false);
        },
      });
    },
    [createSpot],
  );

  if (error && !spots?.length) {
    return (
      <ScreenLayout title={t('tabs.foraging')}>
        <EmptyState
          title={t('foraging.couldNotLoad')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={t('tabs.foraging')}>
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
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryText, { color: colors.text.primary }]}>
            {spots?.length ?? 0} {t('foraging.spots')}
          </Text>
          {isFetching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddForm(true)}
        >
          <Text style={[styles.addButtonText, { color: colors.text.inverse }]}>
            {t('foraging.addSpot')}
          </Text>
        </Pressable>
      </View>

      {/* Month filter */}
      <View style={styles.filterBar}>
        <Chip
          label={t('common.all')}
          selected={!selectedMonth}
          onPress={() => setSelectedMonth(undefined)}
        />
        {MONTHS.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={selectedMonth === m}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          />
        ))}
      </View>

      {showAddForm && (
        <View
          style={[
            styles.modalBackdrop,
            Platform.OS === 'web' && ({ position: 'fixed', zIndex: 100 } as any),
          ]}
        >
          <Pressable style={styles.modalBackdropTouchable} onPress={() => setShowAddForm(false)} />
          <AddSpotForm
            types={types ?? []}
            onSubmit={handleAddSpot}
            onCancel={() => setShowAddForm(false)}
            onUseCurrentLocation={handleUseCurrentLocation}
            isSubmitting={createSpot.isPending}
          />
        </View>
      )}

      {isLoading ? (
        <EmptyState title={t('foraging.loadingSpots')} />
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SpotItem spot={item} typeColor={colorMap.get(item.type) ?? colors.text.muted} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t('foraging.noSpotsFound')} />}
          ListHeaderComponent={
            isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBackdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  spotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spotName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  monthTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    fontSize: fontSize.xs,
    overflow: 'hidden',
  },
  spotNotes: {
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg + spacing.sm,
  },
  coords: {
    fontSize: fontSize.xs,
    marginLeft: spacing.lg + spacing.sm,
  },
});
