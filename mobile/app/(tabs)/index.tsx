import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FloatingButton } from '@/components/FloatingButton';
import { FloatingCardOverlay } from '@/components/FloatingCardOverlay';
import { ForagingSpotCard } from '@/components/ForagingSpotCard';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { LayerToggle, type MapLayer } from '@/components/LayerToggle';
import { PlaceCard } from '@/components/PlaceCard';
import { TrackingControls } from '@/components/TrackingControls';
import { TrackingOverlay } from '@/components/TrackingOverlay';
import { TrailCard } from '@/components/TrailCard';
import { type MapLayers, UnifiedMap } from '@/components/UnifiedMap';
import {
  useDeleteTrail,
  useForagingSpots,
  useForagingTypes,
  usePlaces,
  useTrails,
  useUpdateForagingSpot,
  useUpdateTrail,
} from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useSettings } from '@/lib/settings-context';
import { spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';
import { useTracking } from '@/lib/tracking-context';
import type { ForagingSpot, Place, Trail } from '@/lib/types';

type SelectedItem =
  | { type: 'trail'; data: Trail }
  | { type: 'spot'; data: ForagingSpot }
  | { type: 'place'; data: Place };

export default function MapScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { enabledPlaceCategories } = useSettings();
  const { trailId } = useLocalSearchParams<{ trailId?: string }>();

  const { data: trails, isFetching: trailsFetching } = useTrails();
  const { data: spots } = useForagingSpots();
  const { data: types } = useForagingTypes();
  const { data: places } = usePlaces();
  const { points: recordingPoints } = useTracking();
  const updateTrail = useUpdateTrail();
  const deleteTrail = useDeleteTrail();
  const updateSpot = useUpdateForagingSpot();

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
  const [showMenu, setShowMenu] = useState(false);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  // When navigating from trail list with trailId param, select and focus that trail
  const [focusBounds, setFocusBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  useEffect(() => {
    if (!trailId || !trails) return;
    const trail = trails.find((t) => t.trail_id === trailId);
    if (!trail) return;
    setSelected({ type: 'trail', data: trail });
    setFocusBounds({ ...trail.bounds });
  }, [trailId, trails]);

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

  const handleTrailUpdate = useCallback(
    (trailId: string, data: Parameters<typeof updateTrail.mutate>[0]['data'], onSuccess: () => void) => {
      updateTrail.mutate({ id: trailId, data }, { onSuccess });
    },
    [updateTrail],
  );

  const handleSpotUpdate = useCallback(
    (id: string, data: Parameters<typeof updateSpot.mutate>[0]['data'], onSuccess: () => void) => {
      updateSpot.mutate({ id, data }, { onSuccess });
    },
    [updateSpot],
  );

  const selectedTrailId = selected?.type === 'trail' ? selected.data.trail_id : null;
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <UnifiedMap
        trails={trails ?? []}
        foragingSpots={spots ?? []}
        foragingTypes={types ?? []}
        places={filteredPlaces}
        layers={mapLayers}
        selectedTrailId={selectedTrailId}
        focusBounds={focusBounds}
        recordingPoints={recordingPoints}
        onTrailSelect={handleTrailSelect}
        onSpotSelect={handleSpotSelect}
        onPlaceSelect={handlePlaceSelect}
      />

      {/* Layer toggle button (top-left) */}
      <View style={styles.layerButton}>
        <FloatingButton label={t('map.layers')} onPress={() => setShowLayers((v) => !v)} />
      </View>

      {/* Hamburger menu (top-right) */}
      <View style={styles.menuContainer}>
        <HamburgerMenu
          isOpen={showMenu}
          onToggle={() => setShowMenu((v) => !v)}
          onSettings={() => {
            const { router } = require('expo-router');
            router.push('/settings');
          }}
          onStartTracking={() => {
            if (isWeb) {
              Alert.alert(t('tracking.startTracking'), t('tracking.webNotSupported'));
            }
          }}
          showTrackingItem={isWeb}
        />
      </View>

      {/* Native GPS tracking controls (no-op on web) */}
      <TrackingControls />

      {/* Tracking stats overlay (shared across platforms) */}
      <TrackingOverlay />

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

      {/* Floating card for selected item */}
      <FloatingCardOverlay isOpen={!!selected} onClose={() => setSelected(null)}>
        {selected?.type === 'trail' && (
          <TrailCard
            trail={selected.data}
            onClose={() => setSelected(null)}
            onUpdate={handleTrailUpdate}
            isUpdating={updateTrail.isPending}
            onDelete={(id) => deleteTrail.mutate(id)}
            isDeleting={deleteTrail.isPending}
          />
        )}

        {selected?.type === 'spot' && (
          <ForagingSpotCard
            spot={selected.data}
            onClose={() => setSelected(null)}
            onUpdate={handleSpotUpdate}
            isUpdating={updateSpot.isPending}
          />
        )}

        {selected?.type === 'place' && (
          <PlaceCard
            place={selected.data}
            onClose={() => setSelected(null)}
          />
        )}
      </FloatingCardOverlay>
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
  menuContainer: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
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
});
