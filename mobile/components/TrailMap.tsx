import { useEffect, useRef } from 'react';
import { injectLeafletCSS } from '@/lib/inject-css';
import { useTheme } from '@/lib/theme';
import type { Trail, TrailImage } from '@/lib/types';

interface TrailImagePin {
  trailId: string;
  image: TrailImage;
}

interface TrailMapProps {
  trails: Trail[];
  onTrailSelect?: (trail: Trail) => void;
  imagePins?: TrailImagePin[];
}

// Default center: Skåne, Sweden
const DEFAULT_CENTER: [number, number] = [55.95, 13.4];
const DEFAULT_ZOOM = 9;

export function TrailMap({ trails, onTrailSelect, imagePins }: TrailMapProps) {
  const { colors } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const onTrailSelectRef = useRef(onTrailSelect);
  onTrailSelectRef.current = onTrailSelect;
  const imagePinsRef = useRef(imagePins);
  imagePinsRef.current = imagePins;

  useEffect(() => {
    // Dynamically import leaflet and its CSS (web only)
    let cancelled = false;

    async function initMap() {
      injectLeafletCSS(colors);
      const [L, { LocateControl }] = await Promise.all([
        import('leaflet'),
        import('leaflet.locatecontrol'),
      ]);

      if (cancelled || !mapRef.current) return;

      // Don't re-init if already created
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // User location control — shows a "locate me" button on the map
      new LocateControl({
        position: 'topleft',
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

      // Add trail polylines in two passes:
      // 1. "To Explore" trails (orange) rendered first → bottom layer
      // 2. Explored trails (blue) rendered second → painted on top
      const toExplore = trails.filter((t) => t.status !== 'Explored!');
      const explored = trails.filter((t) => t.status === 'Explored!');

      for (const trail of [...toExplore, ...explored]) {
        if (!trail.coordinates_map || trail.coordinates_map.length === 0) continue;

        const latlngs = trail.coordinates_map.map((c) => [c.lat, c.lng] as [number, number]);
        const isExplored = trail.status === 'Explored!';
        const color = trail.line_color ?? (isExplored ? '#4169E1' : '#E53E3E');
        const polyline = L.polyline(latlngs, {
          color,
          weight: isExplored ? 4 : 3,
          opacity: 0.8,
        }).addTo(map);

        polyline.on('click', () => {
          if (onTrailSelectRef.current) {
            onTrailSelectRef.current(trail);
          }
        });
      }

      // Add image pin markers for trails with primary photos
      if (imagePinsRef.current) {
        for (const pin of imagePinsRef.current) {
          const { image } = pin;
          if (image.lat == null || image.lng == null) continue;

          const iconHtml = `<div style="
            width: 40px; height: 40px; border-radius: 50%;
            border: 3px solid ${colors.status.exploredText}; overflow: hidden;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            background: #fff;
          "><img src="data:image/jpeg;base64,${image.image_data}"
            style="width: 100%; height: 100%; object-fit: cover;"
          /></div>`;

          const icon = L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [46, 46],
            iconAnchor: [23, 23],
          });

          L.marker([image.lat, image.lng], { icon }).addTo(map).on('click', () => {
            const matchTrail = trails.find((t) => t.trail_id === pin.trailId);
            if (matchTrail && onTrailSelectRef.current) {
              onTrailSelectRef.current(matchTrail);
            }
          });
        }
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [trails]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
}
