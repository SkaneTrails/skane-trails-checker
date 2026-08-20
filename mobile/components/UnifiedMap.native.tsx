/**
 * Native map implementation using MapLibre GL v11 with OpenStreetMap raster tiles.
 *
 * Renders trails as line layers, foraging spots as circle markers,
 * and place icons when zoomed in. Supports live recording polyline.
 * Fully free — no API key or billing required.
 */

import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  ImageSource,
  Layer,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { foragingColorMap } from '@/lib/foraging-colors';
import { type GeoCoord, type MapOverlay, rotateCorners } from '@/lib/map-overlays';
import { useTheme } from '@/lib/theme';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { ForagingSpot, ForagingType, ImagePin, Place, Trail } from '@/lib/types';

export interface MapLayers {
  trails: boolean;
  foraging: boolean;
  places: boolean;
  images: boolean;
}

interface UnifiedMapProps {
  trails: Trail[];
  foragingSpots: ForagingSpot[];
  foragingTypes: ForagingType[];
  places: Place[];
  layers: MapLayers;
  selectedTrailId?: string | null;
  focusBounds?: { north: number; south: number; east: number; west: number } | null;
  recordingPoints?: TrackingPoint[];
  /** Primary trail image locations for map markers */
  imagePins?: ImagePin[];
  /** Georeferenced image overlays to render on the map */
  imageOverlays?: MapOverlay[];
  /** Id of the overlay currently being edited (shows draggable handles) */
  editingOverlayId?: string | null;
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onImagePinSelect?: (trailId: string) => void;
  onOverlayCornersChange?: (id: string, corners: MapOverlay['corners']) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

const DEFAULT_CENTER: [number, number] = [13.4, 55.95];
const DEFAULT_ZOOM = 7;
const PLACES_MIN_ZOOM = 13;
const RECORDING_COLOR = '#ef4444';

/** OpenStreetMap raster tiles — free, no API key required. */
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '\u00a9 OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 19 }],
};

function trailToGeoJSON(trail: Trail, fallbackColor: string): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: { id: trail.trail_id, color: trail.line_color ?? fallbackColor },
    geometry: {
      type: 'LineString',
      coordinates: (trail.coordinates_map ?? []).map((c) => [c.lng, c.lat]),
    },
  };
}

function recordingToGeoJSON(points: TrackingPoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  };
}

export function UnifiedMap({
  trails,
  foragingSpots,
  foragingTypes,
  places,
  layers,
  selectedTrailId,
  focusBounds,
  recordingPoints,
  imagePins,
  imageOverlays = [],
  editingOverlayId,
  onTrailSelect,
  onSpotSelect,
  onPlaceSelect,
  onImagePinSelect,
  onOverlayCornersChange,
  onMapClick,
  onLongPress,
  onBoundsChange,
}: UnifiedMapProps) {
  const { colors } = useTheme();
  const cameraRef = useRef<CameraRef>(null);
  // @ts-expect-error — MapLibre RN type definition doesn't match runtime component shape
  const mapRef = useRef<InstanceType<typeof Map>>(null);
  const boundsRequestRef = useRef(0);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  const colorMap = foragingColorMap(foragingTypes);
  const showPlaces = currentZoom >= PLACES_MIN_ZOOM;

  // Viewport geometry needed to convert pixel drags into geo coordinates
  // when editing an overlay's corner/rotation handles.
  const [viewBounds, setViewBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(null);

  const exploredTrails = layers.trails
    ? trails.filter((t) => t.status === 'Explored!' && t.coordinates_map?.length)
    : [];
  const unexploredTrails = layers.trails
    ? trails.filter((t) => t.status !== 'Explored!' && t.coordinates_map?.length)
    : [];

  // Focus map on bounds when requested (e.g. from trail list navigation)
  useEffect(() => {
    if (!focusBounds || !cameraRef.current) return;
    const { north, south, east, west } = focusBounds;
    cameraRef.current.fitBounds([west, south, east, north], {
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      duration: 1000,
    });
  }, [focusBounds]);

  const exploredGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: exploredTrails.map((t) => trailToGeoJSON(t, colors.explored)),
  };

  const unexploredGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: unexploredTrails.map((t) => trailToGeoJSON(t, colors.toExplore)),
  };

  const spotsGeoJSON: GeoJSON.FeatureCollection = layers.foraging
    ? {
        type: 'FeatureCollection',
        features: foragingSpots.map((spot) => ({
          type: 'Feature' as const,
          properties: {
            id: spot.id,
            color: colorMap.get(spot.type) ?? colors.text.muted,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [spot.lng, spot.lat],
          },
        })),
      }
    : { type: 'FeatureCollection', features: [] };

  const placesGeoJSON: GeoJSON.FeatureCollection =
    layers.places && showPlaces
      ? {
          type: 'FeatureCollection',
          features: places.map((place) => ({
            type: 'Feature' as const,
            properties: { id: place.place_id, name: place.name },
            geometry: {
              type: 'Point' as const,
              coordinates: [place.lng, place.lat],
            },
          })),
        }
      : { type: 'FeatureCollection', features: [] };

  const imagePinsGeoJSON: GeoJSON.FeatureCollection =
    layers.images && imagePins?.length
      ? {
          type: 'FeatureCollection',
          features: imagePins.map((pin) => ({
            type: 'Feature' as const,
            properties: { trailId: pin.trail_id },
            geometry: {
              type: 'Point' as const,
              coordinates: [pin.lng, pin.lat],
            },
          })),
        }
      : { type: 'FeatureCollection', features: [] };

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) =>
        setMapSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE}
        // @ts-expect-error — logoEnabled exists at runtime but not in MapLibre RN type defs
        logoEnabled={false}
        attributionPosition={{ bottom: 8, right: 8 }}
        onPress={(e) => {
          const { lngLat } = e.nativeEvent;
          onMapClick?.(lngLat[1], lngLat[0]);
        }}
        onLongPress={(e) => {
          const { lngLat } = e.nativeEvent;
          onLongPress?.(lngLat[1], lngLat[0]);
        }}
        onRegionDidChange={async (e) => {
          const zoom = e.nativeEvent?.zoom;
          if (zoom != null) setCurrentZoom(zoom);
          if (onBoundsChange && mapRef.current) {
            const requestId = ++boundsRequestRef.current;
            try {
              const bounds = await mapRef.current.getBounds();
              if (bounds && requestId === boundsRequestRef.current) {
                const next = {
                  west: bounds[0],
                  south: bounds[1],
                  east: bounds[2],
                  north: bounds[3],
                };
                setViewBounds(next);
                onBoundsChange(next);
              }
            } catch {
              /* ignore */
            }
          }
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />

        {/* @ts-expect-error — MapLibre UserLocation prop types incomplete */}
        <UserLocation visible />

        {/* Image overlays — rendered below trails so trails are visible on top */}
        {imageOverlays.map((overlay) => (
          <ImageSource
            key={overlay.id}
            id={`overlay-${overlay.id}`}
            url={overlay.imageUri}
            coordinates={[
              [overlay.corners[0][1], overlay.corners[0][0]], // Top-left: [lng, lat]
              [overlay.corners[1][1], overlay.corners[1][0]], // Top-right
              [overlay.corners[2][1], overlay.corners[2][0]], // Bottom-right
              [overlay.corners[3][1], overlay.corners[3][0]], // Bottom-left
            ]}
          >
            <Layer
              id={`overlay-layer-${overlay.id}`}
              type="raster"
              paint={{
                'raster-opacity': overlay.opacity,
              }}
            />
          </ImageSource>
        ))}

        {/* Draggable corner + rotation handles for the overlay being edited */}
        {(() => {
          const editing = editingOverlayId
            ? imageOverlays.find((o) => o.id === editingOverlayId)
            : null;
          if (!editing || !viewBounds || !mapSize || !onOverlayCornersChange) return null;
          return (
            <OverlayEditHandles
              overlay={editing}
              bounds={viewBounds}
              size={mapSize}
              primaryColor={colors.primary}
              onChange={onOverlayCornersChange}
            />
          );
        })()}

        {/* Explored trails */}
        <GeoJSONSource
          id="explored-trails"
          data={exploredGeoJSON}
          onPress={(e) => {
            const trailId = e.nativeEvent.features?.[0]?.properties?.id;
            const trail = trails.find((t) => t.trail_id === trailId);
            if (trail) onTrailSelect?.(trail);
          }}
        >
          <Layer
            id="explored-trails-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 4,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </GeoJSONSource>

        {/* Unexplored trails */}
        <GeoJSONSource
          id="unexplored-trails"
          data={unexploredGeoJSON}
          onPress={(e) => {
            const trailId = e.nativeEvent.features?.[0]?.properties?.id;
            const trail = trails.find((t) => t.trail_id === trailId);
            if (trail) onTrailSelect?.(trail);
          }}
        >
          <Layer
            id="unexplored-trails-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 3,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </GeoJSONSource>

        {/* Selected trail highlight */}
        {selectedTrailId &&
          (() => {
            const selectedTrail = trails.find((t) => t.trail_id === selectedTrailId);
            if (!selectedTrail?.coordinates_map?.length) return null;
            const selectedColor =
              selectedTrail.line_color ??
              (selectedTrail.status === 'Explored!' ? colors.explored : colors.toExplore);
            const selectedGeoJSON: GeoJSON.FeatureCollection = {
              type: 'FeatureCollection',
              features: [trailToGeoJSON(selectedTrail, selectedColor)],
            };
            return (
              <GeoJSONSource id="selected-trail" data={selectedGeoJSON}>
                <Layer
                  id="selected-trail-line"
                  type="line"
                  paint={{
                    'line-color': ['get', 'color'],
                    'line-width': 7,
                  }}
                  layout={{
                    'line-cap': 'round',
                    'line-join': 'round',
                  }}
                />
              </GeoJSONSource>
            );
          })()}

        {/* Foraging spots */}
        <GeoJSONSource
          id="foraging-spots"
          data={spotsGeoJSON}
          onPress={(e) => {
            const spotId = e.nativeEvent.features?.[0]?.properties?.id;
            const spot = foragingSpots.find((s) => s.id === spotId);
            if (spot) onSpotSelect?.(spot);
          }}
        >
          <Layer
            id="foraging-spots-circle"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>

        {/* Places */}
        <GeoJSONSource
          id="places"
          data={placesGeoJSON}
          onPress={(e) => {
            const placeId = e.nativeEvent.features?.[0]?.properties?.id;
            const place = places.find((p) => p.place_id === placeId);
            if (place) onPlaceSelect?.(place);
          }}
        >
          <Layer
            id="places-circle"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': colors.layer.places,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="places-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-offset': [0, 1.5],
              'text-anchor': 'top',
            }}
            paint={{
              'text-color': colors.text.primary,
              'text-halo-color': '#ffffff',
              'text-halo-width': 1,
            }}
          />
        </GeoJSONSource>

        {/* Image pin markers — primary photos with GPS */}
        <GeoJSONSource
          id="image-pins"
          data={imagePinsGeoJSON}
          onPress={(e) => {
            const trailId = e.nativeEvent.features?.[0]?.properties?.trailId;
            if (trailId) onImagePinSelect?.(trailId);
          }}
        >
          <Layer
            id="image-pins-circle"
            type="circle"
            paint={{
              'circle-radius': 10,
              'circle-color': colors.explored,
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id="image-pins-icon"
            type="symbol"
            layout={{
              'text-field': '📷',
              'text-size': 12,
            }}
          />
        </GeoJSONSource>

        {/* Live recording polyline */}
        {recordingPoints && recordingPoints.length >= 2 && (
          <GeoJSONSource id="recording" data={recordingToGeoJSON(recordingPoints)}>
            <Layer
              id="recording-line"
              type="line"
              paint={{
                'line-color': RECORDING_COLOR,
                'line-width': 4,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}

interface OverlayEditHandlesProps {
  overlay: MapOverlay;
  bounds: { north: number; south: number; east: number; west: number };
  size: { width: number; height: number };
  primaryColor: string;
  onChange: (id: string, corners: MapOverlay['corners']) => void;
}

/** Stable keys for the four overlay corners (top-left, top-right, …). */
const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'] as const;

/** Stable keys for the four overlay edge (mid-side) handles. */
const EDGE_KEYS = ['top', 'right', 'bottom', 'left'] as const;

/** Corner index pairs forming each edge: top, right, bottom, left. */
const EDGE_PAIRS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
] as const;

/**
 * Draggable corner + rotation handles for an overlay being edited.
 *
 * MapLibre RN markers aren't natively draggable, so we drive position with a
 * PanResponder and convert pixel deltas to geo deltas using the current map
 * bounds and view size. Changes are applied live to local state and committed
 * to the parent on release.
 */
function OverlayEditHandles({
  overlay,
  bounds,
  size,
  primaryColor,
  onChange,
}: OverlayEditHandlesProps) {
  const [liveCorners, setLiveCorners] = useState<MapOverlay['corners']>(overlay.corners);
  const liveRef = useRef(liveCorners);
  liveRef.current = liveCorners;

  // Resync when the overlay changes externally (and not mid-drag).
  useEffect(() => {
    setLiveCorners(overlay.corners);
  }, [overlay.corners]);

  const lngPerPx = (bounds.east - bounds.west) / size.width;
  const latPerPx = (bounds.north - bounds.south) / size.height;

  // Corner handles — each drag translates a single corner.
  const cornerResponders = overlay.corners.map((startCorner, index) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        const dLng = gesture.dx * lngPerPx;
        const dLat = -gesture.dy * latPerPx;
        const next = liveRef.current.map((c) => [...c]) as MapOverlay['corners'];
        next[index] = [startCorner[0] + dLat, startCorner[1] + dLng];
        setLiveCorners(next);
      },
      onPanResponderRelease: () => onChange(overlay.id, liveRef.current),
    }),
  );

  // Edge (mid-side) handles — each drag translates the whole side (two corners).
  const edgeResponders = EDGE_PAIRS.map(([a, b]) => {
    const startA = overlay.corners[a];
    const startB = overlay.corners[b];
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        const dLng = gesture.dx * lngPerPx;
        const dLat = -gesture.dy * latPerPx;
        const next = liveRef.current.map((c) => [...c]) as MapOverlay['corners'];
        next[a] = [startA[0] + dLat, startA[1] + dLng];
        next[b] = [startB[0] + dLat, startB[1] + dLng];
        setLiveCorners(next);
      },
      onPanResponderRelease: () => onChange(overlay.id, liveRef.current),
    });
  });

  // Rotation handle geometry derived from the original corners.
  const center: GeoCoord = [
    (overlay.corners[0][0] + overlay.corners[2][0]) / 2,
    (overlay.corners[0][1] + overlay.corners[2][1]) / 2,
  ];
  const topMid: GeoCoord = [
    (overlay.corners[0][0] + overlay.corners[1][0]) / 2,
    (overlay.corners[0][1] + overlay.corners[1][1]) / 2,
  ];
  const handleStart: GeoCoord = [
    center[0] + (topMid[0] - center[0]) * 1.4,
    center[1] + (topMid[1] - center[1]) * 1.4,
  ];
  const angleTo = (lat: number, lng: number) => Math.atan2(lng - center[1], lat - center[0]);
  const baseAngle = angleTo(handleStart[0], handleStart[1]);

  const rotateResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_evt, gesture) => {
      const curLat = handleStart[0] - gesture.dy * latPerPx;
      const curLng = handleStart[1] + gesture.dx * lngPerPx;
      const delta = angleTo(curLat, curLng) - baseAngle;
      setLiveCorners(rotateCorners(overlay.corners, delta));
    },
    onPanResponderRelease: () => onChange(overlay.id, liveRef.current),
  });

  // Live rotation handle position tracks the current corners.
  const liveCenter: GeoCoord = [
    (liveCorners[0][0] + liveCorners[2][0]) / 2,
    (liveCorners[0][1] + liveCorners[2][1]) / 2,
  ];
  const liveTopMid: GeoCoord = [
    (liveCorners[0][0] + liveCorners[1][0]) / 2,
    (liveCorners[0][1] + liveCorners[1][1]) / 2,
  ];
  const liveRotateHandle: GeoCoord = [
    liveCenter[0] + (liveTopMid[0] - liveCenter[0]) * 1.4,
    liveCenter[1] + (liveTopMid[1] - liveCenter[1]) * 1.4,
  ];

  // Live edge-handle positions track the midpoint of each side.
  const edgeMidpoints = EDGE_PAIRS.map(
    ([a, b]) =>
      [
        (liveCorners[a][0] + liveCorners[b][0]) / 2,
        (liveCorners[a][1] + liveCorners[b][1]) / 2,
      ] as GeoCoord,
  );

  return (
    <>
      {liveCorners.map((corner, index) => (
        <Marker
          key={`overlay-corner-${overlay.id}-${CORNER_KEYS[index]}`}
          lngLat={[corner[1], corner[0]]}
        >
          <View
            style={[styles.cornerHandle, { borderColor: primaryColor }]}
            {...cornerResponders[index].panHandlers}
          />
        </Marker>
      ))}
      {edgeMidpoints.map((m, index) => (
        <Marker key={`overlay-edge-${overlay.id}-${EDGE_KEYS[index]}`} lngLat={[m[1], m[0]]}>
          <View
            style={[styles.edgeHandle, { backgroundColor: primaryColor }]}
            {...edgeResponders[index].panHandlers}
          />
        </Marker>
      ))}
      <Marker
        key={`overlay-rotate-${overlay.id}`}
        lngLat={[liveRotateHandle[1], liveRotateHandle[0]]}
      >
        <View
          style={[styles.rotateHandle, { backgroundColor: primaryColor }]}
          {...rotateResponder.panHandlers}
        />
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  cornerHandle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 3,
  },
  edgeHandle: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  rotateHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
