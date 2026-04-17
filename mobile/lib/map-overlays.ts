/**
 * Map overlay types and storage for georeferenced image overlays.
 *
 * Allows users to overlay photos (paper maps, trail diagrams) on the OSM map,
 * align them using corner dragging, and adjust transparency.
 * Data is stored locally in AsyncStorage — no server sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Geographic coordinate [latitude, longitude] */
export type GeoCoord = [number, number];

/**
 * A georeferenced image overlay on the map.
 * Corners are in clockwise order starting from top-left.
 */
export interface MapOverlay {
  id: string;
  name: string;
  /** Local file URI (from expo-file-system) */
  imageUri: string;
  /** Four corners: [topLeft, topRight, bottomRight, bottomLeft] */
  corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
  /** Opacity from 0.0 (transparent) to 1.0 (opaque) */
  opacity: number;
  /** Whether the overlay is currently visible on the map */
  visible: boolean;
  /** ISO timestamp when overlay was created */
  createdAt: string;
}

/** Payload for creating a new overlay */
export interface MapOverlayCreate {
  name: string;
  imageUri: string;
  /** Initial corners — typically computed from map center */
  corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
}

/** Payload for updating an existing overlay */
export interface MapOverlayUpdate {
  name?: string;
  corners?: [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
  opacity?: number;
  visible?: boolean;
}

const STORAGE_KEY = '@skane_trails_map_overlays';

/** Generate a unique ID for new overlays */
function generateId(): string {
  return `overlay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hook for managing map overlays stored in AsyncStorage.
 */
export function useMapOverlays() {
  const [overlays, setOverlays] = useState<MapOverlay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load overlays from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setOverlays(parsed);
          }
        }
      } catch {
        // Use empty array on error
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Persist overlays to storage
  const persist = useCallback(async (updated: MapOverlay[]) => {
    setOverlays(updated);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

  /** Add a new overlay */
  const addOverlay = useCallback(
    async (create: MapOverlayCreate): Promise<MapOverlay> => {
      const newOverlay: MapOverlay = {
        id: generateId(),
        name: create.name,
        imageUri: create.imageUri,
        corners: create.corners,
        opacity: 0.7, // Default semi-transparent
        visible: true,
        createdAt: new Date().toISOString(),
      };
      await persist([...overlays, newOverlay]);
      return newOverlay;
    },
    [overlays, persist],
  );

  /** Update an existing overlay */
  const updateOverlay = useCallback(
    async (id: string, update: MapOverlayUpdate): Promise<void> => {
      const updated = overlays.map((o) =>
        o.id === id ? { ...o, ...update } : o,
      );
      await persist(updated);
    },
    [overlays, persist],
  );

  /** Delete an overlay by ID */
  const deleteOverlay = useCallback(
    async (id: string): Promise<void> => {
      const updated = overlays.filter((o) => o.id !== id);
      await persist(updated);
    },
    [overlays, persist],
  );

  /** Toggle visibility of an overlay */
  const toggleVisibility = useCallback(
    async (id: string): Promise<void> => {
      const updated = overlays.map((o) =>
        o.id === id ? { ...o, visible: !o.visible } : o,
      );
      await persist(updated);
    },
    [overlays, persist],
  );

  /** Get visible overlays only */
  const visibleOverlays = overlays.filter((o) => o.visible);

  return {
    overlays,
    visibleOverlays,
    isLoading,
    addOverlay,
    updateOverlay,
    deleteOverlay,
    toggleVisibility,
  };
}

/**
 * Calculate initial corners for a new overlay centered on the map.
 * Creates a rectangle spanning approximately the given size in degrees.
 */
export function calculateInitialCorners(
  centerLat: number,
  centerLng: number,
  /** Width in degrees (longitude) */
  width = 0.01,
  /** Height in degrees (latitude) */
  height = 0.008,
): [GeoCoord, GeoCoord, GeoCoord, GeoCoord] {
  const halfW = width / 2;
  const halfH = height / 2;
  return [
    [centerLat + halfH, centerLng - halfW], // Top-left
    [centerLat + halfH, centerLng + halfW], // Top-right
    [centerLat - halfH, centerLng + halfW], // Bottom-right
    [centerLat - halfH, centerLng - halfW], // Bottom-left
  ];
}

/**
 * Rotate corners around the center by a given angle in radians.
 */
export function rotateCorners(
  corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord],
  angleRad: number,
): [GeoCoord, GeoCoord, GeoCoord, GeoCoord] {
  // Calculate center
  const centerLat = (corners[0][0] + corners[2][0]) / 2;
  const centerLng = (corners[0][1] + corners[2][1]) / 2;

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return corners.map(([lat, lng]) => {
    const dLat = lat - centerLat;
    const dLng = lng - centerLng;
    const newLat = centerLat + dLat * cos - dLng * sin;
    const newLng = centerLng + dLat * sin + dLng * cos;
    return [newLat, newLng] as GeoCoord;
  }) as [GeoCoord, GeoCoord, GeoCoord, GeoCoord];
}

/**
 * Calculate the center point of the overlay from its corners.
 */
export function getOverlayCenter(
  corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord],
): GeoCoord {
  const lat = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
  const lng = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
  return [lat, lng];
}

/**
 * Calculate the current rotation angle of the overlay in radians.
 * Based on the angle from top-left to top-right corner.
 */
export function getOverlayRotation(
  corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord],
): number {
  const [topLeft, topRight] = corners;
  const dLat = topRight[0] - topLeft[0];
  const dLng = topRight[1] - topLeft[1];
  return Math.atan2(dLat, dLng);
}
