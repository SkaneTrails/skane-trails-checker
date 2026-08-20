import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { AddSpotForm } from '@/components/AddSpotForm';
import { FloatingButton } from '@/components/FloatingButton';
import { FloatingCardOverlay } from '@/components/FloatingCardOverlay';
import { ForagingDrawer } from '@/components/ForagingDrawer';
import { ForagingSpotCard } from '@/components/ForagingSpotCard';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { ImageLightbox } from '@/components/ImageLightbox';
import { LayerToggle, type MapLayer } from '@/components/LayerToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OverlayEditPanel } from '@/components/OverlayEditPanel';
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
  useCreateForagingType,
  useDeleteTrail,
  useForagingSpots,
  useForagingTypes,
  useImagePins,
  useMapTrails,
  usePlaces,
  useTrailImages,
  useUpdateForagingSpot,
  useUpdateTrail,
} from '@/lib/hooks';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { getCurrentPosition } from '@/lib/location';
import {
  calculateInitialCorners,
  type GeoCoord,
  type MapOverlay,
  useMapOverlays,
} from '@/lib/map-overlays';
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
    images: true,
  });

  const { data: imagePins } = useImagePins({ enabled: mapLayers.images });

  // Image lightbox — opened by tapping a photo bubble on the map
  const [lightboxTrailId, setLightboxTrailId] = useState<string | null>(null);
  const { data: lightboxImagesData } = useTrailImages(lightboxTrailId ?? '');
  const lightboxImages = useMemo(
    () =>
      (lightboxImagesData?.images ?? []).map((img) => ({
        uri: `data:image/jpeg;base64,${img.image_data}`,
        caption: img.caption,
      })),
    [lightboxImagesData],
  );

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
  const createType = useCreateForagingType();

  // Overlay management state
  const { overlays, addOverlay, updateOverlay, deleteOverlay } = useMapOverlays();
  const [showOverlayManager, setShowOverlayManager] = useState(false);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Get the overlay being edited
  const editingOverlay = editingOverlayId ? overlays.find((o) => o.id === editingOverlayId) : null;

  // Visible overlays rendered on the map (the edited overlay stays visible so
  // its draggable handles track the live image).
  const visibleOverlays = useMemo(() => {
    return overlays.filter((o) => o.visible);
  }, [overlays]);

  // When navigating from trail list with trailId param, select and focus that trail
  const [focusBounds, setFocusBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

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
    {
      id: 'trails',
      label: t('tabs.trails'),
      icon: '',
      color: colors.layer.trails,
      enabled: mapLayers.trails,
    },
    {
      id: 'foraging',
      label: t('tabs.foraging'),
      icon: '',
      color: colors.layer.foraging,
      enabled: mapLayers.foraging,
    },
    {
      id: 'places',
      label: t('tabs.places'),
      icon: '',
      color: colors.layer.places,
      enabled: mapLayers.places,
    },
    {
      id: 'images',
      label: t('map.images'),
      icon: '',
      color: colors.layer.trails,
      enabled: mapLayers.images,
    },
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

  const handleImagePinSelect = useCallback((trailId: string) => {
    setLightboxTrailId(trailId);
  }, []);
  const handleTrailUpdate = useCallback(
    (
      trailId: string,
      data: Parameters<typeof updateTrail.mutate>[0]['data'],
      onSuccess: () => void,
    ) => {
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
      // Get image dimensions to preserve aspect ratio for the initial placement
      const imgSize = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(
          imageUri,
          (w, h) => resolve({ width: w, height: h }),
          () => resolve({ width: 4, height: 3 }),
        );
      });

      let corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
      if (mapBounds) {
        const { north, south, east, west } = mapBounds;
        const centerLat = (north + south) / 2;
        const centerLng = (east + west) / 2;
        const aspect = imgSize.width / imgSize.height;
        // Place the overlay at ~50% of the current view height, aspect-correct.
        const heightLat = (north - south) * 0.5;
        const cosLat = Math.cos((centerLat * Math.PI) / 180) || 1;
        const widthLng = (heightLat * aspect) / cosLat;

        corners = [
          [centerLat + heightLat / 2, centerLng - widthLng / 2], // Top-left
          [centerLat + heightLat / 2, centerLng + widthLng / 2], // Top-right
          [centerLat - heightLat / 2, centerLng + widthLng / 2], // Bottom-right
          [centerLat - heightLat / 2, centerLng - widthLng / 2], // Bottom-left
        ];
      } else {
        corners = calculateInitialCorners(55.95, 13.4, 0.05, 0.04);
      }
      const overlay = await addOverlay({ name, imageUri, corners });
      setShowOverlayManager(false);
      // Enter edit mode so the user can drag the corners into place
      setEditingOverlayId(overlay.id);
    },
    [addOverlay, mapBounds],
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

  const handleOverlayCornersChange = useCallback(
    (id: string, corners: MapOverlay['corners']) => {
      void updateOverlay(id, { corners });
    },
    [updateOverlay],
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
    if (!editingOverlay || !editingOverlayId) return;
    let corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
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
    void updateOverlay(editingOverlayId, { corners, opacity: 0.7 });
  }, [editingOverlay, editingOverlayId, updateOverlay, mapBounds]);

  const handleDeleteEditingOverlay = useCallback(() => {
    if (!editingOverlayId) return;
    void deleteOverlay(editingOverlayId);
    setEditingOverlayId(null);
  }, [editingOverlayId, deleteOverlay]);

  const handleDoneEditing = useCallback(() => {
    setEditingOverlayId(null);
  }, []);

  // Handle map click — dismiss any open card/panel
  const handleMapClick = useCallback(
    (_lat: number, _lng: number) => {
      if (selected) setSelected(null);
      if (showOverlayManager) setShowOverlayManager(false);
    },
    [selected, showOverlayManager],
  );

  // Long-press on map → open add foraging spot form with pre-filled coordinates
  const handleLongPress = useCallback(
    (lat: number, lng: number) => {
      if (editingOverlayId) return; // Ignore during overlay alignment
      setSelected(null);
      setShowOverlayManager(false);
      setLongPressCoords({ lat, lng });
      setSpotLocationError(false);
      createSpot.reset();
      createType.reset();
      setShowAddSpot(true);
    },
    [editingOverlayId, createSpot, createType],
  );

  const handleAddSpot = useCallback(
    (data: ForagingSpotCreate & { newType?: { name: string; icon: string } }) => {
      const { newType, ...spotData } = data;
      const createTheSpot = () => {
        createSpot.mutate(spotData, {
          onSuccess: () => {
            setShowAddSpot(false);
            setLongPressCoords(null);
            setSpotLocationError(false);
          },
        });
      };
      // Create the custom type first so it exists before the spot references it.
      if (newType) {
        createType.mutate(newType, { onSuccess: createTheSpot });
      } else {
        createTheSpot();
      }
    },
    [createSpot, createType],
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
        imagePins={imagePins}
        imageOverlays={visibleOverlays}
        editingOverlayId={editingOverlayId}
        onTrailSelect={handleTrailSelect}
        onSpotSelect={handleSpotSelect}
        onPlaceSelect={handlePlaceSelect}
        onImagePinSelect={handleImagePinSelect}
        onOverlayCornersChange={handleOverlayCornersChange}
        onMapClick={handleMapClick}
        onLongPress={handleLongPress}
        onBoundsChange={setMapBounds}
      />

      <OfflineBanner />

      {/* Fullscreen image viewer (opened by tapping a map photo bubble) */}
      <ImageLightbox
        images={lightboxImages}
        visible={lightboxTrailId !== null && lightboxImages.length > 0}
        onClose={() => setLightboxTrailId(null)}
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
          <PlaceCard place={selected.data} onClose={() => setSelected(null)} />
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
            submitError={createSpot.error || createType.error}
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

      {/* Overlay edit panel — corners/rotation handled on the map directly */}
      {editingOverlay && (
        <OverlayEditPanel
          overlay={editingOverlay}
          onUpdateOpacity={handleUpdateOverlayOpacity}
          onReset={handleResetOverlay}
          onDelete={handleDeleteEditingOverlay}
          onDone={handleDoneEditing}
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
          createSpot.reset();
          createType.reset();
          setShowAddSpot(true);
        }}
      />

      <PlacesDrawer isOpen={showPlacesDrawer} onClose={() => setShowPlacesDrawer(false)} />
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
