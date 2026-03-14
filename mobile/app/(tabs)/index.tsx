import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ScreenLayout, StatusBadge } from '@/components';
import { BottomSheet } from '@/components/BottomSheet';
import { FloatingButton } from '@/components/FloatingButton';
import { LayerToggle, type MapLayer } from '@/components/LayerToggle';
import { PlaceCategoryIcon } from '@/components/PlaceCategoryIcon';
import { TabIcon } from '@/components/TabIcon';
import { type MapLayers, UnifiedMap } from '@/components/UnifiedMap';
import { useForagingSpots, useForagingTypes, usePlaces, useTrails } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/lib/settings-context';
import { borderRadius, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';
import type { ForagingSpot, Place, Trail } from '@/lib/types';

type SelectedItem =
  | { type: 'trail'; data: Trail }
  | { type: 'spot'; data: ForagingSpot }
  | { type: 'place'; data: Place };

export default function MapScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { enabledPlaceCategories } = useSettings();

  const { data: trails, isFetching: trailsFetching } = useTrails();
  const { data: spots } = useForagingSpots(undefined, { enabled: Platform.OS === 'web' });
  const { data: types } = useForagingTypes({ enabled: Platform.OS === 'web' });
  const { data: places } = usePlaces();

  const filteredPlaces = useMemo(
    () =>
      (places ?? []).filter((p) =>
        p.categories.some((c) => enabledPlaceCategories.includes(c.slug)),
      ),
    [places, enabledPlaceCategories],
  );

  const [mapLayers, setMapLayers] = useState<MapLayers>({
    trails: true,
    foraging: true,
    places: true,
  });

  const [showLayers, setShowLayers] = useState(false);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const layerList: MapLayer[] = [
    { id: 'trails', label: t('tabs.trails'), icon: '', color: colors.layer.trails, enabled: mapLayers.trails },
    { id: 'foraging', label: t('tabs.foraging'), icon: '', color: colors.layer.foraging, enabled: mapLayers.foraging },
    { id: 'places', label: t('tabs.places'), icon: '', color: colors.layer.places, enabled: mapLayers.places },
  ];

  const handleToggleLayer = useCallback((layerId: string) => {
    setMapLayers((prev) => ({ ...prev, [layerId]: !prev[layerId as keyof MapLayers] }));
  }, []);

  const handleTrailSelect = useCallback((trail: Trail) => {
    setSelected({ type: 'trail', data: trail });
  }, []);

  const handleSpotSelect = useCallback((spot: ForagingSpot) => {
    setSelected({ type: 'spot', data: spot });
  }, []);

  const handlePlaceSelect = useCallback((place: Place) => {
    setSelected({ type: 'place', data: place });
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <ScreenLayout>
        <EmptyState title={t('map.webOnly')} subtitle={t('map.useTrailsTab')} />
      </ScreenLayout>
    );
  }

  return (
    <View style={styles.container}>
      <UnifiedMap
        trails={trails ?? []}
        foragingSpots={spots ?? []}
        foragingTypes={types ?? []}
        places={filteredPlaces}
        layers={mapLayers}
        onTrailSelect={handleTrailSelect}
        onSpotSelect={handleSpotSelect}
        onPlaceSelect={handlePlaceSelect}
      />

      {/* Layer toggle button (top-left) */}
      <View style={styles.layerButton}>
        <FloatingButton label={t('map.layers')} onPress={() => setShowLayers((v) => !v)} />
      </View>

      {/* Settings button (top-right) */}
      <Pressable
        onPress={() => router.push('/settings' as never)}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        style={[styles.settingsButton, glassPill(colors.glass), shadows.subtle]}
      >
        <TabIcon name="settings" color={colors.text.secondary} size={20} strokeWidth={1.5} />
      </Pressable>

      {/* Layer toggle panel */}
      {showLayers && (
        <View style={styles.layerPanel}>
          <LayerToggle layers={layerList} onToggle={handleToggleLayer} />
        </View>
      )}

      {/* Loading indicator */}
      {trailsFetching && (
        <View style={[styles.spinner, glassPill(colors.glass)]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Bottom sheet for selected item */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)}>
        {selected?.type === 'trail' && (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>
                {selected.data.name}
              </Text>
              <StatusBadge status={selected.data.status} />
            </View>
            <View style={styles.sheetMeta}>
              <Text style={[styles.metaItem, { color: colors.text.secondary }]}>
                {selected.data.length_km.toFixed(1)} km
              </Text>
              {!!selected.data.difficulty && (
                <Text style={[styles.metaItem, { color: colors.text.secondary }]}>
                  {selected.data.difficulty}
                </Text>
              )}
              {selected.data.elevation_gain != null && (
                <Text style={[styles.metaItem, { color: colors.text.secondary }]}>
                  +{Math.round(selected.data.elevation_gain)} m
                </Text>
              )}
            </View>
            <Button
              title={t('trailCard.viewDetails')}
              onPress={() => {
                setSelected(null);
                router.push(`/trail/${selected.data.trail_id}`);
              }}
              pill
            />
          </View>
        )}

        {selected?.type === 'spot' && (
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>
              {selected.data.type}
            </Text>
            <Text style={[styles.metaItem, { color: colors.text.secondary }]}>
              {selected.data.month}
            </Text>
            {selected.data.notes ? (
              <Text style={[styles.spotNotes, { color: colors.text.primary }]}>
                {selected.data.notes}
              </Text>
            ) : null}
            <Text style={[styles.coordText, { color: colors.text.muted }]}>
              {selected.data.lat.toFixed(4)}, {selected.data.lng.toFixed(4)}
            </Text>
          </View>
        )}

        {selected?.type === 'place' && (
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: colors.text.primary }]}>
              {selected.data.name}
            </Text>
            {!!selected.data.city && (
              <Text style={[styles.metaItem, { color: colors.text.secondary }]}>
                {selected.data.city}
              </Text>
            )}
            {selected.data.categories.length > 0 && (
              <View style={styles.tagRow}>
                {selected.data.categories.map((cat) => (
                  <View
                    key={cat.slug}
                    style={[
                      styles.tag,
                      { backgroundColor: colors.tag.placeBg },
                    ]}
                  >
                    <PlaceCategoryIcon slug={cat.slug} size={12} strokeWidth={2} />
                    <Text style={{ color: colors.tag.placeText, fontSize: fontSize.sm }}>
                      {cat.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {!!selected.data.weburl && (
              <Text style={[styles.metaItem, { color: colors.primary }]} numberOfLines={1}>
                {selected.data.weburl}
              </Text>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layerButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 900,
  },
  settingsButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 900,
    padding: spacing.sm + 2,
  },
  layerPanel: {
    position: 'absolute',
    top: spacing.lg + 48,
    left: spacing.lg,
    zIndex: 900,
  },
  spinner: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg + 44,
    padding: spacing.sm,
    zIndex: 800,
  },
  sheetContent: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    flex: 1,
    marginRight: spacing.md,
  },
  sheetMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: fontSize.md,
  },
  spotNotes: {
    fontSize: fontSize.md,
  },
  coordText: {
    fontSize: fontSize.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
});
