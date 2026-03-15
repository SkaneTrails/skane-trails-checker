/**
 * Native map implementation using react-native-maps (Google Maps on Android).
 *
 * Renders trails as polylines, foraging spots as colored markers,
 * and place icons when zoomed in. Supports live recording polyline.
 */

import { useRef, useState } from 'react';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { foragingColorMap } from '@/lib/foraging-colors';
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
  recordingPoints?: TrackingPoint[];
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const DEFAULT_REGION = {
  latitude: 55.95,
  longitude: 13.4,
  latitudeDelta: 1.5,
  longitudeDelta: 1.5,
};

const PLACES_MIN_ZOOM_DELTA = 0.05;
const RECORDING_COLOR = '#ef4444';

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
  const mapRef = useRef<MapView>(null);
  const [showPlaces, setShowPlaces] = useState(false);

  const colorMap = foragingColorMap(foragingTypes);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onMapClick?.(latitude, longitude);
        }}
        onRegionChangeComplete={(region) => {
          setShowPlaces(region.latitudeDelta < PLACES_MIN_ZOOM_DELTA);
        }}
      >
        {/* Trail polylines */}
        {layers.trails &&
          trails.map((trail) => {
            if (!trail.coordinates_map || trail.coordinates_map.length === 0) return null;
            const isExplored = trail.status === 'Explored!';
            const isSelected = trail.trail_id === selectedTrailId;
            const color = isExplored ? colors.explored : colors.toExplore;
            const baseWeight = isExplored ? 4 : 3;

            return (
              <Polyline
                key={trail.trail_id}
                coordinates={trail.coordinates_map.map((c) => ({
                  latitude: c.lat,
                  longitude: c.lng,
                }))}
                strokeColor={color}
                strokeWidth={isSelected ? baseWeight + 3 : baseWeight}
                tappable
                onPress={() => onTrailSelect?.(trail)}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}

        {/* Foraging markers */}
        {layers.foraging &&
          foragingSpots.map((spot) => (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              pinColor={colorMap.get(spot.type) ?? colors.text.muted}
              onPress={() => onSpotSelect?.(spot)}
            />
          ))}

        {/* Place markers (only when zoomed in) */}
        {layers.places &&
          showPlaces &&
          places.map((place) => (
            <Marker
              key={place.place_id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              onPress={() => onPlaceSelect?.(place)}
            />
          ))}

        {/* Live recording polyline */}
        {recordingPoints && recordingPoints.length >= 2 && (
          <Polyline
            coordinates={recordingPoints.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeColor={RECORDING_COLOR}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
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
