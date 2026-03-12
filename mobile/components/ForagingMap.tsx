import { useEffect, useRef } from 'react';
import type { ForagingSpot, ForagingType } from '@/lib/types';
import { injectLeafletCSS } from '@/lib/inject-css';

interface ForagingMapProps {
  spots: ForagingSpot[];
  types: ForagingType[];
  onSpotSelect?: (spot: ForagingSpot) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [55.95, 13.4];
const DEFAULT_ZOOM = 9;

export function ForagingMap({ spots, types, onSpotSelect, onMapClick }: ForagingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const onSpotSelectRef = useRef(onSpotSelect);
  const onMapClickRef = useRef(onMapClick);
  onSpotSelectRef.current = onSpotSelect;
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      injectLeafletCSS();
      const [L, { LocateControl }] = await Promise.all([
        import('leaflet'),
        import('leaflet.locatecontrol'),
      ]);

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

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

      const typeMap = new Map(types.map((t) => [t.name, t]));

      for (const spot of spots) {
        const typeInfo = typeMap.get(spot.type);
        const emoji = typeInfo?.icon ?? '📍';

        const icon = L.divIcon({
          html: `<span style="font-size:24px;line-height:1;cursor:pointer">${emoji}</span>`,
          className: 'foraging-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);

        marker.on('click', () => {
          onSpotSelectRef.current?.(spot);
        });
      }

      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [spots, types]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
}
