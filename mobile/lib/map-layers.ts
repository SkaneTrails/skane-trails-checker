/**
 * Map layer visibility, persisted on the device (AsyncStorage) so the layers
 * the user switched off stay off the next time the app opens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface MapLayers {
  trails: boolean;
  foraging: boolean;
  places: boolean;
  images: boolean;
}

const STORAGE_KEY = '@skane_trails_map_layers';

export const DEFAULT_MAP_LAYERS: MapLayers = {
  trails: true,
  foraging: true,
  places: true,
  images: true,
};

// Everything off until the saved choice is read, so hidden layers never fetch their data.
const NOT_LOADED: MapLayers = {
  trails: false,
  foraging: false,
  places: false,
  images: false,
};

/** Merge stored JSON over the defaults, ignoring anything that is not a boolean. */
export function parseStoredLayers(stored: string | null): MapLayers {
  if (!stored) return DEFAULT_MAP_LAYERS;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_MAP_LAYERS;
    const record = parsed as Record<string, unknown>;
    const pick = (key: keyof MapLayers) =>
      typeof record[key] === 'boolean' ? (record[key] as boolean) : DEFAULT_MAP_LAYERS[key];
    return {
      trails: pick('trails'),
      foraging: pick('foraging'),
      places: pick('places'),
      images: pick('images'),
    };
  } catch {
    return DEFAULT_MAP_LAYERS;
  }
}

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayers>(NOT_LOADED);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLayers(parseStoredLayers(await AsyncStorage.getItem(STORAGE_KEY)));
      } catch {
        setLayers(DEFAULT_MAP_LAYERS);
      } finally {
        setIsLoaded(true);
      }
    };
    void load();
  }, []);

  const toggleLayer = useCallback(
    (id: keyof MapLayers) => {
      if (!isLoaded) return;
      setLayers((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [isLoaded],
  );

  return { layers, toggleLayer, isLoaded };
}
