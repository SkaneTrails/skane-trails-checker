/**
 * Native map implementation using MapLibre GL with OpenStreetMap tiles.
 *
 * Renders trails as line layers, foraging spots as circle markers,
 * and place icons when zoomed in. Supports live recording polyline.
 * Fully free — no API key or billing required.
 */

import { useRef, useState } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import { foragingColorMap } from '@/lib/foraging-colors';
import { useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingType, Place, Trail } from '@/lib/types';
import type { TrackingPoint } from '@/lib/track-to-trail';

MapLibreGL.setAccessToken(null);

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
  recordingPoints?: TrackingPoint[];
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [13.4, 55.95];
const DEFAULT_ZOOM = 7;
const PLACES_MIN_ZOOM = 13;
const RECORDING_COLOR = '#ef4444';
/**
 * Inline MapLibre style spec using OpenStreetMap raster tiles.
 * Avoids depending on the MapLibre demo endpoint which is rate-limited
 * and not intended for production use.
 */
const OSM_STYLE: MapLibreGL.StyleURL = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as unknown as MapLibreGL.StyleURL;

function trailToGeoJSON(trail: Trail): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: { id: trail.trail_id },
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
  recordingPoints,
  onTrailSelect,
  onSpotSelect,
  onPlaceSelect,
  onMapClick,
}: UnifiedMapProps) {
  const { colors } = useTheme();
  const cameraRef = useRef<MapLibreGL.Camera>(null);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  const colorMap = foragingColorMap(foragingTypes);
  const showPlaces = currentZoom >= PLACES_MIN_ZOOM;

  const exploredTrails = layers.trails
    ? trails.filter((t) => t.status === 'Explored!' && t.coordinates_map?.length)
    : [];
  const unexploredTrails = layers.trails
    ? trails.filter((t) => t.status !== 'Explored!' && t.coordinates_map?.length)
    : [];

  const exploredGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: exploredTrails.map(trailToGeoJSON),
  };

  const unexploredGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: unexploredTrails.map(trailToGeoJSON),
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
      <MapLibreGL.MapView
        style={styles.map}
        styleJSON={JSON.stringify(OSM_STYLE)}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, right: 8 }}
        onPress={(e) => {
          const coords = e.geometry as GeoJSON.Point;
          onMapClick?.(coords.coordinates[1], coords.coordinates[0]);
        }}
        onRegionDidChange={(e) => {
          if (e.properties?.zoomLevel != null) {
            setCurrentZoom(e.properties.zoomLevel as number);
          }
        }}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        <MapLibreGL.UserLocation visible />

        {/* Explored trails */}
        <MapLibreGL.ShapeSource
          id="explored-trails"
          shape={exploredGeoJSON}
          onPress={(e) => {
            const trailId = e.features?.[0]?.properties?.id;
            const trail = trails.find((t) => t.trail_id === trailId);
            if (trail) onTrailSelect?.(trail);
          }}
        >
          <MapLibreGL.LineLayer
            id="explored-trails-line"
            style={{
              lineColor: colors.explored,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Unexplored trails */}
        <MapLibreGL.ShapeSource
          id="unexplored-trails"
          shape={unexploredGeoJSON}
          onPress={(e) => {
            const trailId = e.features?.[0]?.properties?.id;
            const trail = trails.find((t) => t.trail_id === trailId);
            if (trail) onTrailSelect?.(trail);
          }}
        >
          <MapLibreGL.LineLayer
            id="unexplored-trails-line"
            style={{
              lineColor: colors.toExplore,
              lineWidth: 3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Selected trail highlight */}
        {selectedTrailId && (() => {
          const selectedTrail = trails.find((t) => t.trail_id === selectedTrailId);
          if (!selectedTrail?.coordinates_map?.length) return null;
          const selectedGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [trailToGeoJSON(selectedTrail)],
          };
          return (
            <MapLibreGL.ShapeSource id="selected-trail" shape={selectedGeoJSON}>
              <MapLibreGL.LineLayer
                id="selected-trail-line"
                style={{
                  lineColor: selectedTrail.status === 'Explored!' ? colors.explored : colors.toExplore,
                  lineWidth: 7,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </MapLibreGL.ShapeSource>
          );
        })()}

        {/* Foraging spots */}
        <MapLibreGL.ShapeSource
          id="foraging-spots"
          shape={spotsGeoJSON}
          onPress={(e) => {
            const spotId = e.features?.[0]?.properties?.id;
            const spot = foragingSpots.find((s) => s.id === spotId);
            if (spot) onSpotSelect?.(spot);
          }}
        >
          <MapLibreGL.CircleLayer
            id="foraging-spots-circle"
            style={{
              circleRadius: 8,
              circleColor: ['get', 'color'],
              circleStrokeWidth: 2,
              circleStrokeColor: '#ffffff',
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Places */}
        <MapLibreGL.ShapeSource
          id="places"
          shape={placesGeoJSON}
          onPress={(e) => {
            const placeId = e.features?.[0]?.properties?.id;
            const place = places.find((p) => p.place_id === placeId);
            if (place) onPlaceSelect?.(place);
          }}
        >
          <MapLibreGL.CircleLayer
            id="places-circle"
            style={{
              circleRadius: 6,
              circleColor: colors.layer.places,
              circleStrokeWidth: 1.5,
              circleStrokeColor: '#ffffff',
            }}
          />
          <MapLibreGL.SymbolLayer
            id="places-label"
            style={{
              textField: ['get', 'name'],
              textSize: 11,
              textOffset: [0, 1.5],
              textAnchor: 'top',
              textColor: colors.text.primary,
              textHaloColor: '#ffffff',
              textHaloWidth: 1,
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Live recording polyline */}
        {recordingPoints && recordingPoints.length >= 2 && (
          <MapLibreGL.ShapeSource
            id="recording"
            shape={recordingToGeoJSON(recordingPoints)}
          >
            <MapLibreGL.LineLayer
              id="recording-line"
              style={{
                lineColor: RECORDING_COLOR,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>
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
