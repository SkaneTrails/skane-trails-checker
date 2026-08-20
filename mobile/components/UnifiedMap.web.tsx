/**
 * Unified map with toggleable layers for trails, foraging spots, and places.
 *
 * Replaces separate TrailMap and ForagingMap with a single map instance
 * showing all data types as independently toggleable layers.
 */

import { useEffect, useRef, useState } from 'react';
import { foragingColorMap } from '@/lib/foraging-colors';
import { matrix3dForQuad, type Point } from '@/lib/homography';
import { injectLeafletCSS } from '@/lib/inject-css';
import type { GeoCoord, MapOverlay } from '@/lib/map-overlays';
import { placeCategoryColor } from '@/lib/place-colors';
import { animation, iconSize, useTheme } from '@/lib/theme';
import type { ColorTokens } from '@/lib/theme/colors';
import type { TrackingPoint } from '@/lib/track-to-trail';
import type { ForagingSpot, ForagingType, ImagePin, Place, Trail } from '@/lib/types';
import { FALLBACK_PATH, ICON_PATHS } from './PlaceCategoryIcon';

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
  /** Georeferenced image overlays to render on the map */
  imageOverlays?: MapOverlay[];
  /** ID of the overlay currently being edited (shows draggable handles) */
  editingOverlayId?: string | null;
  onTrailSelect?: (trail: Trail) => void;
  onSpotSelect?: (spot: ForagingSpot) => void;
  onPlaceSelect?: (place: Place) => void;
  onImagePinSelect?: (trailId: string) => void;
  /** Called when the user finishes dragging an overlay corner/rotation handle */
  onOverlayCornersChange?: (id: string, corners: MapOverlay['corners']) => void;
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
  imageOverlays,
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

  const callbackRefs = useRef({
    onTrailSelect,
    onSpotSelect,
    onPlaceSelect,
    onImagePinSelect,
    onMapClick,
    onLongPress,
    onBoundsChange,
  });
  callbackRefs.current = {
    onTrailSelect,
    onSpotSelect,
    onPlaceSelect,
    onImagePinSelect,
    onMapClick,
    onLongPress,
    onBoundsChange,
  };

  // Overlay rendering + editing state (kept in refs to avoid stale closures in
  // imperative Leaflet event handlers).
  const overlaysDataRef = useRef({ imageOverlays, editingOverlayId });
  overlaysDataRef.current = { imageOverlays, editingOverlayId };
  const onOverlayCornersChangeRef = useRef(onOverlayCornersChange);
  onOverlayCornersChangeRef.current = onOverlayCornersChange;
  /** DOM <img> elements rendered into the overlay pane, keyed by overlay id. */
  const overlayElsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  /** Screen-space root <div> hosting the editing overlay image + handles. */
  const editLayerRef = useRef<HTMLDivElement | null>(null);
  /** The editing overlay <img> rendered in screen space (fixed while map moves). */
  const editImgRef = useRef<HTMLImageElement | null>(null);
  /** Live editing corners in container-pixel space (source of truth while editing). */
  const editPixelCornersRef = useRef<[Point, Point, Point, Point] | null>(null);
  /** Geo corners last seeded into pixel space (to detect external resets). */
  const editSeededFromRef = useRef<MapOverlay['corners'] | null>(null);
  /** The overlay id the screen-space edit layer is currently set up for. */
  const editingIdRef = useRef<string | null>(null);
  /** Handle <div>s in fixed order: 4 corners, 4 edges, 1 rotation. */
  const editHandleElsRef = useRef<HTMLElement[]>([]);

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

      // Keep overlay images warped to their geo corners as the map moves/zooms.
      map.on('move zoom viewreset zoomend moveend', () => {
        repositionOverlayImages(map);
      });

      // Report the current view bounds so callers can place overlays/etc. in view.
      const emitBounds = () => {
        const b = map.getBounds();
        callbackRefs.current.onBoundsChange?.({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      };
      map.on('moveend zoomend', emitBounds);
      emitBounds();

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
      [
        [south, west],
        [north, east],
      ],
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

    const { imagePins: pins, layers: l, colors: c } = imagePinsDataRef.current;
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
        callbackRefs.current.onImagePinSelect?.(pin.trail_id);
      });
    }
  }

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      renderImagePins(L, map.getZoom());
    });
  }, [imagePins, layers.images, mapReady]);

  // ---- Image overlays (warped images + draggable editing handles) ----

  /** Warp an <img> so its natural rect maps to the four destination pixel points. */
  function warpImage(img: HTMLImageElement, dst: [Point, Point, Point, Point]) {
    const srcW = img.naturalWidth || 256;
    const srcH = img.naturalHeight || 256;
    img.style.width = `${srcW}px`;
    img.style.height = `${srcH}px`;
    img.style.transform = matrix3dForQuad(srcW, srcH, dst);
  }

  /** Warp a geo-pinned overlay <img> so its source rect maps to the geo corners. */
  function warpOverlayImage(map: L.Map, img: HTMLImageElement, corners: MapOverlay['corners']) {
    const dst = corners.map((c) => {
      const pt = map.latLngToLayerPoint([c[0], c[1]]);
      return { x: pt.x, y: pt.y } as Point;
    }) as [Point, Point, Point, Point];
    warpImage(img, dst);
  }

  /** Reposition every geo-pinned overlay image (skipping the one being edited). */
  function repositionOverlayImages(map: L.Map) {
    const { imageOverlays: ovs, editingOverlayId: editId } = overlaysDataRef.current;
    for (const overlay of ovs ?? []) {
      if (overlay.id === editId) continue; // editing overlay lives in screen space
      const img = overlayElsRef.current.get(overlay.id);
      if (img) warpOverlayImage(map, img, overlay.corners);
    }
  }

  /** Create/update geo-pinned overlay <img> elements (hiding the one being edited). */
  function renderOverlays(map: L.Map) {
    const { imageOverlays: ovs, editingOverlayId: editId } = overlaysDataRef.current;
    const pane = map.getPanes().overlayPane;
    const seen = new Set<string>();

    for (const overlay of ovs ?? []) {
      seen.add(overlay.id);
      let img = overlayElsRef.current.get(overlay.id);
      if (!img) {
        img = document.createElement('img');
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.transformOrigin = '0 0';
        img.style.pointerEvents = 'none';
        img.style.willChange = 'transform';
        img.draggable = false;
        img.src = overlay.imageUri;
        img.onload = () => repositionOverlayImages(map);
        pane.appendChild(img);
        overlayElsRef.current.set(overlay.id, img);
      } else if (img.src !== overlay.imageUri) {
        img.src = overlay.imageUri;
      }
      // Hide the geo-pinned copy while this overlay is being edited in screen space.
      if (overlay.id === editId) {
        img.style.display = 'none';
      } else {
        img.style.display = '';
        img.style.opacity = String(overlay.opacity);
        warpOverlayImage(map, img, overlay.corners);
      }
    }

    // Remove images for overlays that no longer exist.
    for (const [id, img] of overlayElsRef.current) {
      if (!seen.has(id)) {
        img.remove();
        overlayElsRef.current.delete(id);
      }
    }
  }

  // ---- Screen-fixed overlay editing ----
  //
  // While an overlay is being edited it is detached from the map's geo space and
  // pinned to the screen (container pixels) so the user can pan/zoom the map
  // underneath it. The pixel corners are the source of truth during editing and
  // are converted back to geo only when editing ends.

  /** Convert geo corners to container-pixel points. */
  function pixelCornersFromGeo(
    map: L.Map,
    corners: MapOverlay['corners'],
  ): [Point, Point, Point, Point] {
    return corners.map((c) => {
      const pt = map.latLngToContainerPoint([c[0], c[1]]);
      return { x: pt.x, y: pt.y } as Point;
    }) as [Point, Point, Point, Point];
  }

  /** Convert container-pixel editing corners back to geo for persistence. */
  function geoCornersFromPixel(
    map: L.Map,
    px: [Point, Point, Point, Point],
  ): MapOverlay['corners'] {
    return px.map((p) => {
      const ll = map.containerPointToLatLng([p.x, p.y]);
      return [ll.lat, ll.lng] as GeoCoord;
    }) as MapOverlay['corners'];
  }

  /** Derived handle anchor points (edge midpoints + rotation handle) from corners. */
  function editHandlePoints(px: [Point, Point, Point, Point]) {
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const center: Point = { x: (px[0].x + px[2].x) / 2, y: (px[0].y + px[2].y) / 2 };
    const edges: [Point, Point, Point, Point] = [
      mid(px[0], px[1]), // top
      mid(px[1], px[2]), // right
      mid(px[2], px[3]), // bottom
      mid(px[3], px[0]), // left
    ];
    const rotate: Point = {
      x: center.x + (edges[0].x - center.x) * 1.4,
      y: center.y + (edges[0].y - center.y) * 1.4,
    };
    return { center, edges, rotate };
  }

  /** Re-warp the screen-space editing image to its current pixel corners. */
  function warpEditImage() {
    const img = editImgRef.current;
    const px = editPixelCornersRef.current;
    if (img && px) warpImage(img, px);
  }

  /** Move existing handle <div>s to match the current pixel corners (no rebuild). */
  function positionEditHandles() {
    const px = editPixelCornersRef.current;
    const els = editHandleElsRef.current;
    if (!px || els.length !== 9) return;
    const { edges, rotate } = editHandlePoints(px);
    const place = (el: HTMLElement, x: number, y: number) => {
      const w = el.offsetWidth || Number.parseFloat(el.style.width) || 0;
      const h = el.offsetHeight || Number.parseFloat(el.style.height) || 0;
      el.style.left = `${x - w / 2}px`;
      el.style.top = `${y - h / 2}px`;
    };
    px.forEach((c, i) => {
      place(els[i], c.x, c.y);
    });
    edges.forEach((m, i) => {
      place(els[4 + i], m.x, m.y);
    });
    place(els[8], rotate.x, rotate.y);
  }

  /** Drag handler for corner/edge handles: pointer delta → new pixel corners. */
  function attachDrag(
    map: L.Map,
    el: HTMLElement,
    compute: (
      dx: number,
      dy: number,
      start: [Point, Point, Point, Point],
    ) => [Point, Point, Point, Point],
  ) {
    el.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const current = editPixelCornersRef.current;
      if (!current) return;
      const start = current.map((p) => ({ ...p })) as [Point, Point, Point, Point];
      const startX = ev.clientX;
      const startY = ev.clientY;
      map.dragging.disable();
      el.setPointerCapture(ev.pointerId);

      const onMove = (e: PointerEvent) => {
        editPixelCornersRef.current = compute(e.clientX - startX, e.clientY - startY, start);
        warpEditImage();
        positionEditHandles();
      };
      const onUp = (e: PointerEvent) => {
        map.dragging.enable();
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* pointer already released */
        }
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
  }

  /** Rotate the pixel corners around a center by an angle (radians). */
  function rotatePixelCorners(
    corners: [Point, Point, Point, Point],
    center: Point,
    angle: number,
  ): [Point, Point, Point, Point] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return corners.map((p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos } as Point;
    }) as [Point, Point, Point, Point];
  }

  /** Drag handler for the rotation handle: pointer angle → rotated pixel corners. */
  function attachRotateDrag(map: L.Map, el: HTMLElement) {
    el.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const current = editPixelCornersRef.current;
      if (!current) return;
      const start = current.map((p) => ({ ...p })) as [Point, Point, Point, Point];
      const center: Point = { x: (start[0].x + start[2].x) / 2, y: (start[0].y + start[2].y) / 2 };
      const rect = map.getContainer().getBoundingClientRect();
      const angleAt = (clientX: number, clientY: number) =>
        Math.atan2(clientY - rect.top - center.y, clientX - rect.left - center.x);
      const baseAngle = angleAt(ev.clientX, ev.clientY);
      map.dragging.disable();
      el.setPointerCapture(ev.pointerId);

      const onMove = (e: PointerEvent) => {
        const delta = angleAt(e.clientX, e.clientY) - baseAngle;
        editPixelCornersRef.current = rotatePixelCorners(start, center, delta);
        warpEditImage();
        positionEditHandles();
      };
      const onUp = (e: PointerEvent) => {
        map.dragging.enable();
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* pointer already released */
        }
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
  }

  /** Create the screen-space edit layer (root + image) if it does not yet exist. */
  function ensureEditLayer(map: L.Map, overlay: MapOverlay) {
    if (editLayerRef.current) return;
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.overflow = 'hidden';
    root.style.zIndex = '450';

    const img = document.createElement('img');
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    img.style.transformOrigin = '0 0';
    img.style.pointerEvents = 'none';
    img.style.willChange = 'transform';
    img.draggable = false;
    img.src = overlay.imageUri;
    img.style.opacity = String(overlay.opacity);
    img.onload = () => warpEditImage();
    root.appendChild(img);

    map.getContainer().appendChild(root);
    editLayerRef.current = root;
    editImgRef.current = img;
  }

  /** Remove the screen-space edit layer and clear all editing refs. */
  function teardownEditLayer() {
    editLayerRef.current?.remove();
    editLayerRef.current = null;
    editImgRef.current = null;
    editPixelCornersRef.current = null;
    editSeededFromRef.current = null;
    editHandleElsRef.current = [];
  }

  /** Persist the current pixel corners as geo when editing ends (if still present). */
  function commitEdit(map: L.Map, id: string) {
    const px = editPixelCornersRef.current;
    if (!px) return;
    const stillExists = (overlaysDataRef.current.imageOverlays ?? []).some((o) => o.id === id);
    if (!stillExists) return;
    onOverlayCornersChangeRef.current?.(id, geoCornersFromPixel(map, px));
  }

  /** (Re)build the corner + edge + rotation handle <div>s for the edit layer. */
  function buildEditHandles(map: L.Map) {
    const root = editLayerRef.current;
    const px = editPixelCornersRef.current;
    if (!root || !px) return;
    for (const el of editHandleElsRef.current) el.remove();
    editHandleElsRef.current = [];

    const primary = colorsRef.current.primary;
    const { edges, rotate } = editHandlePoints(px);

    const makeHandle = (x: number, y: number, size: number, cursor: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${x - size / 2}px`;
      el.style.top = `${y - size / 2}px`;
      el.style.pointerEvents = 'auto';
      el.style.touchAction = 'none';
      el.style.boxSizing = 'border-box';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.45)';
      el.style.cursor = cursor;
      root.appendChild(el);
      editHandleElsRef.current.push(el);
      return el;
    };

    // Corner handles — move a single corner.
    px.forEach((c, index) => {
      const el = makeHandle(c.x, c.y, 20, 'move');
      el.style.borderRadius = '50%';
      el.style.background = '#fff';
      el.style.border = `3px solid ${primary}`;
      attachDrag(map, el, (dx, dy, start) => {
        const next = start.map((p) => ({ ...p })) as [Point, Point, Point, Point];
        next[index] = { x: start[index].x + dx, y: start[index].y + dy };
        return next;
      });
    });

    // Edge (mid-side) handles — move the whole side.
    edges.forEach((m, index) => {
      const a = index;
      const b = (index + 1) % 4;
      const el = makeHandle(m.x, m.y, 16, index % 2 === 0 ? 'ns-resize' : 'ew-resize');
      el.style.borderRadius = '4px';
      el.style.background = primary;
      el.style.border = '2px solid #fff';
      attachDrag(map, el, (dx, dy, start) => {
        const next = start.map((p) => ({ ...p })) as [Point, Point, Point, Point];
        next[a] = { x: start[a].x + dx, y: start[a].y + dy };
        next[b] = { x: start[b].x + dx, y: start[b].y + dy };
        return next;
      });
    });

    // Rotation handle.
    const rot = makeHandle(rotate.x, rotate.y, 22, 'grab');
    rot.style.borderRadius = '50%';
    rot.style.background = primary;
    rot.style.border = '3px solid #fff';
    rot.style.color = '#fff';
    rot.style.display = 'flex';
    rot.style.alignItems = 'center';
    rot.style.justifyContent = 'center';
    rot.style.fontSize = '13px';
    rot.textContent = '⟳';
    attachRotateDrag(map, rot);
  }

  /** Set up / refresh / tear down the screen-fixed edit layer for the current state. */
  function renderEditOverlay(map: L.Map) {
    const { imageOverlays: ovs, editingOverlayId: editId } = overlaysDataRef.current;
    const prevId = editingIdRef.current;

    // Commit + tear down when leaving (or switching away from) an overlay.
    if (prevId && prevId !== editId) {
      commitEdit(map, prevId);
      teardownEditLayer();
    }

    const overlay = editId ? (ovs ?? []).find((o) => o.id === editId) : null;
    if (!editId || !overlay) {
      editingIdRef.current = null;
      return;
    }

    ensureEditLayer(map, overlay);

    // (Re)seed pixel corners on entry or after an external reset of the corners.
    if (prevId !== editId || editSeededFromRef.current !== overlay.corners) {
      editPixelCornersRef.current = pixelCornersFromGeo(map, overlay.corners);
      editSeededFromRef.current = overlay.corners;
    }
    editingIdRef.current = editId;

    if (editImgRef.current) {
      if (editImgRef.current.src !== overlay.imageUri) editImgRef.current.src = overlay.imageUri;
      editImgRef.current.style.opacity = String(overlay.opacity);
    }
    warpEditImage();
    buildEditHandles(map);
  }

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    renderOverlays(map);
    renderEditOverlay(map);
  }, [imageOverlays, editingOverlayId, mapReady]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
