/**
 * Unified map with toggleable layers for trails, foraging spots, and places.
 *
 * Replaces separate TrailMap and ForagingMap with a single map instance
 * showing all data types as independently toggleable layers.
 */

import { useEffect, useRef, useState } from 'react';
import { foragingColorMap } from '@/lib/foraging-colors';
import { injectLeafletCSS } from '@/lib/inject-css';
import { placeCategoryColor } from '@/lib/place-colors';
import { FALLBACK_PATH, ICON_PATHS } from './PlaceCategoryIcon';
import { animation, iconSize, useTheme } from '@/lib/theme';
import type { ColorTokens } from '@/lib/theme/colors';
import type { ForagingSpot, ForagingType, ImagePin, Place, Trail } from '@/lib/types';
import type { TrackingPoint } from '@/lib/track-to-trail';

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
  imagePins?: ImagePin[];
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

const DEFAULT_CENTER: [number, number] = [55.95, 13.4];
const DEFAULT_ZOOM = 9;
const PLACES_MIN_ZOOM = 12;
const IMAGE_PINS_MIN_ZOOM = 11;

const MAP_DOT_BORDER = '2px solid rgba(255,255,255,0.9)';

/** Generate inline HTML for a colored circle marker. */
function mapDotHtml(color: string, size: number): string {
  return `<div style="width:${size}px;height:${size}px;background:${color};border:${MAP_DOT_BORDER};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer;transition:transform ${animation.duration.fast}ms ease"></div>`;
}

/** Generate inline HTML for a place category icon marker. */
function placeIconHtml(slug: string, color: string, size: number): string {
  const pathData = ICON_PATHS[slug] ?? FALLBACK_PATH;
  const paths = pathData
    .split(' M')
    .map((d, i) => `<path d="${i === 0 ? d : `M${d}`}"/>`)
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">${paths}</svg>`;
}

export function UnifiedMap({
  trails,
  foragingSpots,
  foragingTypes,
  places,
  layers,
  selectedTrailId,
  focusBounds,
  imagePins,
  onTrailSelect,
  onSpotSelect,
  onPlaceSelect,
  onMapClick,
  onLongPress,
}: UnifiedMapProps) {
  const { colors } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const layerGroupsRef = useRef<{
    trails: L.LayerGroup | null;
    foraging: L.LayerGroup | null;
    places: L.LayerGroup | null;
    imagePins: L.LayerGroup | null;
  }>({ trails: null, foraging: null, places: null, imagePins: null });

  const placesDataRef = useRef({ places, layers, colors });
  placesDataRef.current = { places, layers, colors };

  const imagePinsDataRef = useRef({ imagePins, layers, trails, colors });
  imagePinsDataRef.current = { imagePins, layers, trails, colors };

  const callbackRefs = useRef({ onTrailSelect, onSpotSelect, onPlaceSelect, onMapClick, onLongPress });
  callbackRefs.current = { onTrailSelect, onSpotSelect, onPlaceSelect, onMapClick, onLongPress };

  const selectedTrailIdRef = useRef(selectedTrailId);
  selectedTrailIdRef.current = selectedTrailId;

  const colorsRef = useRef<ColorTokens>(colors);
  colorsRef.current = colors;

  // Initialize map once
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      injectLeafletCSS(colorsRef.current);
      const [L, { LocateControl }] = await Promise.all([
        import('leaflet'),
        import('leaflet.locatecontrol'),
      ]);

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current, {
        zoomControl: false,
        // Canvas renderer with generous tolerance for easier touch selection on mobile
        renderer: L.canvas({ tolerance: 15 }),
      }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapInstanceRef.current = map;

      // Zoom at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      new LocateControl({
        position: 'bottomright',
        setView: 'untilPan',
        keepCurrentZoomLevel: true,
        flyTo: true,
        drawCircle: true,
        drawMarker: true,
        showCompass: true,
        showPopup: false,
        metric: true,
        strings: { title: 'Show my location' },
        locateOptions: { enableHighAccuracy: true },
      }).addTo(map);

      // Create layer groups
      layerGroupsRef.current.trails = L.layerGroup().addTo(map);
      layerGroupsRef.current.foraging = L.layerGroup().addTo(map);
      layerGroupsRef.current.places = L.layerGroup().addTo(map);
      layerGroupsRef.current.imagePins = L.layerGroup().addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        callbackRefs.current.onMapClick?.(e.latlng.lat, e.latlng.lng);
      });

      map.on('contextmenu', (e: L.LeafletMouseEvent) => {
        callbackRefs.current.onLongPress?.(e.latlng.lat, e.latlng.lng);
      });

      map.on('zoomend', () => {
        renderPlaces(L, map.getZoom());
        renderImagePins(L, map.getZoom());
      });

      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Focus map on bounds when requested (e.g. from trail list navigation)
  useEffect(() => {
    if (!focusBounds || !mapReady || !mapInstanceRef.current) return;
    const { north, south, east, west } = focusBounds;
    mapInstanceRef.current.fitBounds(
      [[south, west], [north, east]],
      { padding: [40, 40], maxZoom: 14 },
    );
  }, [focusBounds, mapReady]);

  // Update trail layer
  useEffect(() => {
    const group = layerGroupsRef.current.trails;
    if (!group) return;
    group.clearLayers();

    if (!layers.trails) return;

    import('leaflet').then((L) => {
      const toExplore = trails.filter((t) => t.status !== 'Explored!');
      const explored = trails.filter((t) => t.status === 'Explored!');

      for (const trail of [...toExplore, ...explored]) {
        if (!trail.coordinates_map || trail.coordinates_map.length === 0) continue;

        const latlngs = trail.coordinates_map.map((c) => [c.lat, c.lng] as [number, number]);
        const isExplored = trail.status === 'Explored!';
        const isSelected = trail.trail_id === selectedTrailIdRef.current;
        const statusColor = isExplored ? colorsRef.current.explored : colorsRef.current.toExplore;
        const color = trail.line_color ?? statusColor;
        const baseWeight = isExplored ? 4 : 3;

        const polyline = L.polyline(latlngs, {
          color,
          weight: isSelected ? baseWeight + 3 : baseWeight,
          opacity: isSelected ? 1 : 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);

        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          callbackRefs.current.onTrailSelect?.(trail);
        });
      }
    });
  }, [trails, layers.trails, mapReady, selectedTrailId]);

  // Update foraging layer — colored dots
  useEffect(() => {
    const group = layerGroupsRef.current.foraging;
    if (!group) return;
    group.clearLayers();

    if (!layers.foraging) return;

    import('leaflet').then((L) => {
      const colorMap = foragingColorMap(foragingTypes);

      for (const spot of foragingSpots) {
        const spotColor = colorMap.get(spot.type) ?? colorsRef.current.text.muted;

        const icon = L.divIcon({
          html: mapDotHtml(spotColor, iconSize.sm),
          className: 'foraging-dot',
          iconSize: [iconSize.sm, iconSize.sm],
          iconAnchor: [iconSize.sm / 2, iconSize.sm / 2],
        });

        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(group);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          callbackRefs.current.onSpotSelect?.(spot);
        });
      }
    });
  }, [foragingSpots, foragingTypes, layers.foraging, mapReady]);

  // Render places — extracted so both data changes and zoom events can call it
  function renderPlaces(L: typeof import('leaflet'), zoom: number) {
    const group = layerGroupsRef.current.places;
    if (!group) return;
    group.clearLayers();

    const { places: p, layers: l, colors: c } = placesDataRef.current;
    if (!l.places || zoom < PLACES_MIN_ZOOM) return;

    for (const place of p) {
      const firstCat = place.categories[0];
      const catSlug = firstCat?.slug ?? '';
      const catColor = firstCat ? placeCategoryColor(catSlug) : c.text.muted;
      const markerSize = iconSize.lg;

      const icon = L.divIcon({
        html: placeIconHtml(catSlug, catColor, markerSize),
        className: 'place-dot',
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const marker = L.marker([place.lat, place.lng], { icon }).addTo(group);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        callbackRefs.current.onPlaceSelect?.(place);
      });
    }
  }

  // Update places layer — category icon markers, hidden below zoom threshold
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      renderPlaces(L, map.getZoom());
    });
  }, [places, layers.places, mapReady]);

  // Update image pin layer — circular photo bubbles for primary trail images
  function renderImagePins(L: typeof import('leaflet'), zoom: number) {
    const group = layerGroupsRef.current.imagePins;
    if (!group) return;
    group.clearLayers();

    const { imagePins: pins, layers: l, trails: t, colors: c } = imagePinsDataRef.current;
    if (!l.images || zoom < IMAGE_PINS_MIN_ZOOM) return;
    if (!pins || pins.length === 0) return;

    for (const pin of pins) {
      const iconHtml = `<div style="
        width: 36px; height: 36px; border-radius: 50%;
        border: 3px solid ${c.explored};
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        background: #fff;
      "><img src="data:image/jpeg;base64,${pin.thumbnail}"
        style="width: 100%; height: 100%; object-fit: cover;"
      /></div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(group);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const trail = t.find((tr) => tr.trail_id === pin.trail_id);
        if (trail) callbackRefs.current.onTrailSelect?.(trail);
      });
    }
  }

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      renderImagePins(L, map.getZoom());
    });
  }, [imagePins, layers.images, mapReady, trails]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
