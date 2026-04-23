/**
 * Native map implementation using MapLibre GL v11 with OpenStreetMap raster tiles.
 *
 * Renders trails as line layers, foraging spots as circle markers,
 * and place icons when zoomed in. Supports live recording polyline.
 * Fully free — no API key or billing required.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Map,
  Camera,
  GeoJSONSource,
  ImageSource,
  Layer,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import { foragingColorMap } from '@/lib/foraging-colors';
import type { MapOverlay } from '@/lib/map-overlays';
import { useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingType, Place, Trail } from '@/lib/types';
import type { TrackingPoint } from '@/lib/track-to-trail';

export interface MapLayers {
  trails: boolean;
  foraging: boolean;
  places: boolean;
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
  /** Georeferenced image overlays to render on the map */
  imageOverlays?: MapOverlay[];
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
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
  layers: [
    { id: 'osm-tiles', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 19 },
  ],
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
  imageOverlays = [],
  onTrailSelect,
  onSpotSelect,
  onPlaceSelect,
  onMapClick,
}: UnifiedMapProps) {
  const { colors } = useTheme();
  const cameraRef = useRef<CameraRef>(null);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  const colorMap = foragingColorMap(foragingTypes);
  const showPlaces = currentZoom >= PLACES_MIN_ZOOM;

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

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, right: 8 }}

        onPress={(e) => {
          const { lngLat } = e.nativeEvent;
          onMapClick?.(lngLat[1], lngLat[0]);
        }}
        onRegionDidChange={(e) => {
          const zoom = e.nativeEvent?.zoom;
          if (zoom != null) setCurrentZoom(zoom);
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
          }}
        />

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
        {selectedTrailId && (() => {
          const selectedTrail = trails.find((t) => t.trail_id === selectedTrailId);
          if (!selectedTrail?.coordinates_map?.length) return null;
          const selectedColor = selectedTrail.line_color ?? (selectedTrail.status === 'Explored!' ? colors.explored : colors.toExplore);
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
