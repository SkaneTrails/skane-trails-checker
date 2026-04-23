import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FloatingButton } from '@/components/FloatingButton';
import { FloatingCardOverlay } from '@/components/FloatingCardOverlay';
import { ForagingSpotCard } from '@/components/ForagingSpotCard';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { LayerToggle, type MapLayer } from '@/components/LayerToggle';
import { OverlayAlignmentMode } from '@/components/OverlayAlignmentMode';
import { OverlayManager } from '@/components/OverlayManager';
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
import { calculateInitialCorners, useMapOverlays, type MapOverlay } from '@/lib/map-overlays';
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
  const router = useRouter();
  const { trailId, editTrail } = useLocalSearchParams<{ trailId?: string; editTrail?: string }>();

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

  // Overlay management state
  const { overlays, addOverlay, updateOverlay, deleteOverlay } = useMapOverlays();
  const [showOverlayManager, setShowOverlayManager] = useState(false);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [alignmentSelectedCorner, setAlignmentSelectedCorner] = useState<0 | 1 | 2 | 3 | null>(null);

  // Get the overlay being edited
  const editingOverlay = editingOverlayId ? overlays.find((o) => o.id === editingOverlayId) : null;

  // Visible overlays (only show visible ones, or all if in alignment mode)
  const visibleOverlays = useMemo(() => {
    if (editingOverlayId) {
      // During alignment, show only the overlay being edited
      return overlays.filter((o) => o.id === editingOverlayId);
    }
    return overlays.filter((o) => o.visible);
  }, [overlays, editingOverlayId]);

  // When navigating from trail list with trailId param, select and focus that trail
  const [focusBounds, setFocusBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  useEffect(() => {
    if (!trailId || !trails) return;
    const trail = trails.find((t) => t.trail_id === trailId);
    if (!trail) return;
    setSelected({ type: 'trail', data: trail });
    setFocusBounds({ ...trail.bounds });
    // Clear editTrail param after first use to prevent re-triggering edit mode on remount
    if (editTrail === 'true') {
      router.setParams({ editTrail: undefined });
    }
  }, [trailId, trails, editTrail, router]);

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

  // Overlay handlers
  const handleAddOverlay = useCallback(
    async (imageUri: string, name: string) => {
      // Default center: Skåne, Sweden
      const corners = calculateInitialCorners(55.95, 13.4, 0.01, 0.008);
      await addOverlay({
        name,
        imageUri,
        corners,
      });
      setShowOverlayManager(false);
    },
    [addOverlay],
  );

  const handleToggleOverlayVisibility = useCallback(
    (id: string) => {
      const overlay = overlays.find((o) => o.id === id);
      if (overlay) {
        void updateOverlay(id, { visible: !overlay.visible });
      }
    },
    [overlays, updateOverlay],
  );

  const handleEditOverlay = useCallback((id: string) => {
    setEditingOverlayId(id);
    setShowOverlayManager(false);
  }, []);

  const handleUpdateOverlayCorners = useCallback(
    (corners: MapOverlay['corners']) => {
      if (editingOverlayId) {
        void updateOverlay(editingOverlayId, { corners });
      }
    },
    [editingOverlayId, updateOverlay],
  );

  const handleUpdateOverlayOpacity = useCallback(
    (opacity: number) => {
      if (editingOverlayId) {
        void updateOverlay(editingOverlayId, { opacity });
      }
    },
    [editingOverlayId, updateOverlay],
  );

  const handleResetOverlay = useCallback(() => {
    if (editingOverlay) {
      // Reset to default corners (Skåne, Sweden)
      const corners = calculateInitialCorners(55.95, 13.4, 0.01, 0.008);
      void updateOverlay(editingOverlayId!, { corners, opacity: 0.7 });
    }
  }, [editingOverlay, editingOverlayId, updateOverlay]);

  const handleDoneAlignment = useCallback(() => {
    setEditingOverlayId(null);
    setAlignmentSelectedCorner(null);
  }, []);

  // Handle map click during alignment mode
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      // If in alignment mode and a corner is selected, update that corner
      if (editingOverlayId && alignmentSelectedCorner !== null && editingOverlay) {
        const newCorners = [...editingOverlay.corners] as MapOverlay['corners'];
        newCorners[alignmentSelectedCorner] = [lat, lng];
        void updateOverlay(editingOverlayId, { corners: newCorners });
        setAlignmentSelectedCorner(null);
      }
    },
    [editingOverlayId, alignmentSelectedCorner, editingOverlay, updateOverlay],
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
        imageOverlays={visibleOverlays}
        onTrailSelect={handleTrailSelect}
        onSpotSelect={handleSpotSelect}
        onPlaceSelect={handlePlaceSelect}
        onMapClick={handleMapClick}
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
            onDelete={(id, onSuccess) => deleteTrail.mutate(id, { onSuccess })}
            isDeleting={deleteTrail.isPending}
            initialEditing={editTrail === 'true' && selected.data.trail_id === trailId}
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

      {/* Overlay manager button (bottom-left, above tab bar) — native only */}
      {!isWeb && !editingOverlayId && (
        <View style={styles.overlayButton}>
          <FloatingButton
            label={t('overlays.title')}
            onPress={() => setShowOverlayManager(true)}
          />
        </View>
      )}

      {/* Overlay manager panel — native only */}
      {!isWeb && showOverlayManager && (
        <FloatingCardOverlay isOpen onClose={() => setShowOverlayManager(false)}>
          <OverlayManager
            overlays={overlays}
            onAddOverlay={handleAddOverlay}
            onToggleVisibility={handleToggleOverlayVisibility}
            onDeleteOverlay={deleteOverlay}
            onEditOverlay={handleEditOverlay}
            onClose={() => setShowOverlayManager(false)}
          />
        </FloatingCardOverlay>
      )}

      {/* Alignment mode UI */}
      {editingOverlay && (
        <OverlayAlignmentMode
          overlay={editingOverlay}
          selectedCorner={alignmentSelectedCorner}
          onSelectCorner={setAlignmentSelectedCorner}
          onUpdateCorners={handleUpdateOverlayCorners}
          onUpdateOpacity={handleUpdateOverlayOpacity}
          onDone={handleDoneAlignment}
          onReset={handleResetOverlay}
        />
      )}
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
  overlayButton: {
    position: 'absolute',
    bottom: spacing.lg + 80, // Above tab bar
    left: spacing.lg,
    zIndex: 900,
  },
});
