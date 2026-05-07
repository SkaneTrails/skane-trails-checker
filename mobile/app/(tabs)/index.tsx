import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AddSpotForm } from '@/components/AddSpotForm';
import { FloatingButton } from '@/components/FloatingButton';
import { FloatingCardOverlay } from '@/components/FloatingCardOverlay';
import { ForagingDrawer } from '@/components/ForagingDrawer';
import { ForagingSpotCard } from '@/components/ForagingSpotCard';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { LayerToggle, type MapLayer } from '@/components/LayerToggle';
import { OverlayAlignmentMode } from '@/components/OverlayAlignmentMode';
import { OverlayManager } from '@/components/OverlayManager';
import { PlaceCard } from '@/components/PlaceCard';
import { PlacesDrawer } from '@/components/PlacesDrawer';
import { TrackingControls } from '@/components/TrackingControls';
import { TrackingOverlay } from '@/components/TrackingOverlay';
import { TrailCard } from '@/components/TrailCard';
import { TrailListDrawer } from '@/components/TrailListDrawer';
import { type MapLayers, UnifiedMap } from '@/components/UnifiedMap';
import {
  useCreateForagingSpot,
  useDeleteTrail,
  useForagingSpots,
  useForagingTypes,
  useMapTrails,
  usePlaces,
  useUpdateForagingSpot,
  useUpdateTrail,
} from '@/lib/hooks';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { getCurrentPosition } from '@/lib/location';
import { calculateInitialCorners, useMapOverlays, type MapOverlay } from '@/lib/map-overlays';
import { useSettings } from '@/lib/settings-context';
import { spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';
import { useTracking } from '@/lib/tracking-context';
import type { ForagingSpot, ForagingSpotCreate, Place, Trail } from '@/lib/types';

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
  const { data: currentUser } = useCurrentUser();
  const isSuperuser = currentUser?.role === 'superuser';

  const { data: trails, isFetching: trailsFetching } = useMapTrails();
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

  // Drawer states (from hamburger menu)
  const [showTrailDrawer, setShowTrailDrawer] = useState(false);
  const [showForagingDrawer, setShowForagingDrawer] = useState(false);
  const [showPlacesDrawer, setShowPlacesDrawer] = useState(false);

  // Long-press add foraging spot state
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [longPressCoords, setLongPressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [spotLocationError, setSpotLocationError] = useState(false);
  const createSpot = useCreateForagingSpot();

  // Overlay management state
  const { overlays, addOverlay, updateOverlay, deleteOverlay } = useMapOverlays();
  const [showOverlayManager, setShowOverlayManager] = useState(false);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [alignmentSelectedCorner, setAlignmentSelectedCorner] = useState<0 | 1 | 2 | 3 | null>(null);
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [overlayImageSize, setOverlayImageSize] = useState<{ width: number; height: number } | null>(null);

  // Get the overlay being edited
  const editingOverlay = editingOverlayId ? overlays.find((o) => o.id === editingOverlayId) : null;

  // Visible overlays — exclude the editing overlay (it's rendered as screen-fixed during alignment)
  const visibleOverlays = useMemo(() => {
    return overlays.filter((o) => o.visible && o.id !== editingOverlayId);
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
    setMapLayers((prev: MapLayers) => ({ ...prev, [layerId]: !prev[layerId as keyof MapLayers] }));
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
      // Get image dimensions to preserve aspect ratio
      const imgSize = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(imageUri, (w, h) => resolve({ width: w, height: h }), () => resolve({ width: 4, height: 3 }));
      });

      let corners: [import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord];
      if (mapBounds && containerSize) {
        const { north, south, east, west } = mapBounds;
        const viewW = east - west;
        const viewH = north - south;
        const { width: cw, height: ch } = containerSize;

        // Fit image aspect ratio within 80% of viewport (in pixel space)
        const maxW = cw * 0.8;
        const maxH = ch * 0.8;
        const scale = Math.min(maxW / imgSize.width, maxH / imgSize.height);
        const renderedW = imgSize.width * scale;
        const renderedH = imgSize.height * scale;

        // Convert pixel dimensions to geo dimensions
        const geoW = (renderedW / cw) * viewW;
        const geoH = (renderedH / ch) * viewH;
        const centerLat = (north + south) / 2;
        const centerLng = (east + west) / 2;

        corners = [
          [centerLat + geoH / 2, centerLng - geoW / 2],  // Top-left
          [centerLat + geoH / 2, centerLng + geoW / 2],  // Top-right
          [centerLat - geoH / 2, centerLng + geoW / 2],  // Bottom-right
          [centerLat - geoH / 2, centerLng - geoW / 2],  // Bottom-left
        ];
      } else {
        corners = calculateInitialCorners(55.95, 13.4, 0.05, 0.04);
      }
      const overlay = await addOverlay({ name, imageUri, corners });
      setShowOverlayManager(false);
      // Automatically enter alignment mode for the new overlay
      setEditingOverlayId(overlay.id);
      setOverlayImageSize(imgSize);
    },
    [addOverlay, mapBounds, containerSize],
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
    setOverlayImageSize(null);
    // Get image natural dimensions for aspect-ratio-correct geo-mapping
    const overlay = overlays.find((o) => o.id === id);
    if (overlay) {
      Image.getSize(
        overlay.imageUri,
        (w, h) => setOverlayImageSize({ width: w, height: h }),
        () => setOverlayImageSize(null),
      );
    }
  }, [overlays]);

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
      let corners: [import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord];
      if (mapBounds) {
        const { north, south, east, west } = mapBounds;
        const latPad = (north - south) * 0.1;
        const lngPad = (east - west) * 0.1;
        corners = [
          [north - latPad, west + lngPad],
          [north - latPad, east - lngPad],
          [south + latPad, east - lngPad],
          [south + latPad, west + lngPad],
        ];
      } else {
        corners = calculateInitialCorners(55.95, 13.4, 0.05, 0.04);
      }
      void updateOverlay(editingOverlayId!, { corners, opacity: 0.7 });
    }
  }, [editingOverlay, editingOverlayId, updateOverlay, mapBounds]);

  const handleDoneAlignment = useCallback(() => {
    // Lock overlay to geo-coordinates matching the visible image rect on screen
    if (editingOverlayId && mapBounds && containerSize && overlayImageSize) {
      const { north, south, east, west } = mapBounds;
      const { width: cw, height: ch } = containerSize;
      const { width: iw, height: ih } = overlayImageSize;

      // Compute the "contain" rect (where the image actually renders)
      const scale = Math.min(cw / iw, ch / ih);
      const renderedW = iw * scale;
      const renderedH = ih * scale;
      const xOffset = (cw - renderedW) / 2;
      const yOffset = (ch - renderedH) / 2;

      // Convert pixel fractions to geo-coordinates
      const leftFrac = xOffset / cw;
      const rightFrac = (xOffset + renderedW) / cw;
      const topFrac = yOffset / ch;
      const bottomFrac = (yOffset + renderedH) / ch;

      const geoWest = west + leftFrac * (east - west);
      const geoEast = west + rightFrac * (east - west);
      const geoNorth = north - topFrac * (north - south);
      const geoSouth = north - bottomFrac * (north - south);

      const corners: [import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord] = [
        [geoNorth, geoWest],  // Top-left
        [geoNorth, geoEast],  // Top-right
        [geoSouth, geoEast],  // Bottom-right
        [geoSouth, geoWest],  // Bottom-left
      ];
      void updateOverlay(editingOverlayId, { corners });
    } else if (editingOverlayId && mapBounds) {
      // Fallback: use full bounds if image size unknown
      const { north, south, east, west } = mapBounds;
      const corners: [import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord, import('@/lib/map-overlays').GeoCoord] = [
        [north, west], [north, east], [south, east], [south, west],
      ];
      void updateOverlay(editingOverlayId, { corners });
    }
    setEditingOverlayId(null);
    setAlignmentSelectedCorner(null);
    setOverlayImageSize(null);
  }, [editingOverlayId, mapBounds, containerSize, overlayImageSize, updateOverlay]);

  // Handle map click during alignment mode
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      // If in alignment mode and a corner is selected, update that corner
      if (editingOverlayId && alignmentSelectedCorner !== null && editingOverlay) {
        const newCorners = [...editingOverlay.corners] as MapOverlay['corners'];
        newCorners[alignmentSelectedCorner] = [lat, lng];
        void updateOverlay(editingOverlayId, { corners: newCorners });
        setAlignmentSelectedCorner(null);
      } else {
        // Clicking empty map space dismisses any open card/panel
        if (selected) setSelected(null);
        if (showOverlayManager) setShowOverlayManager(false);
      }
    },
    [editingOverlayId, alignmentSelectedCorner, editingOverlay, updateOverlay, selected, showOverlayManager],
  );

  // Long-press on map → open add foraging spot form with pre-filled coordinates
  const handleLongPress = useCallback(
    (lat: number, lng: number) => {
      if (editingOverlayId) return; // Ignore during overlay alignment
      setSelected(null);
      setShowOverlayManager(false);
      setLongPressCoords({ lat, lng });
      setSpotLocationError(false);
      setShowAddSpot(true);
    },
    [editingOverlayId],
  );

  const handleAddSpot = useCallback(
    (data: ForagingSpotCreate) => {
      createSpot.mutate(data, {
        onSuccess: () => {
          setShowAddSpot(false);
          setLongPressCoords(null);
          setSpotLocationError(false);
        },
      });
    },
    [createSpot],
  );

  const handleCancelAddSpot = useCallback(() => {
    setShowAddSpot(false);
    setLongPressCoords(null);
    setSpotLocationError(false);
  }, []);

  const handleUseCurrentLocationForSpot = useCallback(async () => {
    setSpotLocationError(false);
    try {
      const coords = await getCurrentPosition();
      setLongPressCoords({ lat: coords.lat, lng: coords.lng });
    } catch {
      setSpotLocationError(true);
    }
  }, []);

  const selectedTrailId = selected?.type === 'trail' ? selected.data.trail_id : null;

  return (
    <View style={styles.container} onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
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
        onLongPress={handleLongPress}
        onBoundsChange={setMapBounds}
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
          onTrails={() => {
            setShowMenu(false);
            setShowTrailDrawer(true);
          }}
          onForaging={() => {
            setShowMenu(false);
            setShowForagingDrawer(true);
          }}
          onPlaces={() => {
            setShowMenu(false);
            setShowPlacesDrawer(true);
          }}
          onUpload={() => {
            setShowMenu(false);
            router.push('/upload');
          }}
          onOverlays={() => {
            setShowMenu(false);
            setShowOverlayManager(true);
          }}
          onSettings={() => {
            setShowMenu(false);
            router.push('/settings');
          }}
          onAdmin={() => {
            setShowMenu(false);
            router.push('/admin');
          }}
          onStartTracking={() => {
            setShowMenu(false);
          }}
          showAdmin={isSuperuser}
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
      <FloatingCardOverlay isOpen={!!selected}>
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

      {/* Add foraging spot form (triggered by long-press on map) */}
      <FloatingCardOverlay isOpen={showAddSpot}>
        {showAddSpot && (
          <AddSpotForm
            types={types ?? []}
            initialLat={longPressCoords?.lat}
            initialLng={longPressCoords?.lng}
            onSubmit={handleAddSpot}
            onCancel={handleCancelAddSpot}
            onUseCurrentLocation={handleUseCurrentLocationForSpot}
            isSubmitting={createSpot.isPending}
            locationError={spotLocationError}
          />
        )}
      </FloatingCardOverlay>

      {/* Overlay manager panel */}
      {showOverlayManager && (
        <FloatingCardOverlay isOpen>
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

      {/* Screen-fixed overlay image during alignment */}
      {editingOverlay && (
        <View
          style={styles.screenOverlay}
          pointerEvents="none"
        >
          <Image
            source={{ uri: editingOverlay.imageUri }}
            style={[styles.screenOverlayImage, { opacity: editingOverlay.opacity }]}
            resizeMode="contain"
          />
        </View>
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

      {/* Navigation drawers (from hamburger menu) */}
      <TrailListDrawer
        isOpen={showTrailDrawer}
        onClose={() => setShowTrailDrawer(false)}
        onTrailSelect={(trail) => {
          setSelected({ type: 'trail', data: trail });
          setFocusBounds({ ...trail.bounds });
        }}
        onUpload={() => {
          setShowTrailDrawer(false);
          router.push('/upload');
        }}
      />

      <ForagingDrawer
        isOpen={showForagingDrawer}
        onClose={() => setShowForagingDrawer(false)}
        onAddSpot={() => {
          setShowAddSpot(true);
        }}
      />

      <PlacesDrawer
        isOpen={showPlacesDrawer}
        onClose={() => setShowPlacesDrawer(false)}
      />
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
  screenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
  },
  screenOverlayImage: {
    width: '100%',
    height: '100%',
  },
});
