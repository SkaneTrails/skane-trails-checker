import { useEffect, useRef } from 'react';
import type { Trail } from '@/lib/types';

interface TrailMapProps {
  trails: Trail[];
}

// Default center: Skåne, Sweden
const DEFAULT_CENTER: [number, number] = [55.95, 13.4];
const DEFAULT_ZOOM = 9;

export function TrailMap({ trails }: TrailMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    // Dynamically import leaflet and its CSS (web only)
    let cancelled = false;

    async function initMap() {
      const [L, { LocateControl }] = await Promise.all([
        import('leaflet'),
        import('leaflet.locatecontrol'),
        import('leaflet/dist/leaflet.css'),
        import('leaflet.locatecontrol/dist/L.Control.Locate.min.css'),
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

      // Add trail polylines
      for (const trail of trails) {
        if (!trail.coordinates_map || trail.coordinates_map.length === 0) continue;

        const latlngs = trail.coordinates_map.map((c) => [c.lat, c.lng] as [number, number]);
        const color = trail.status === 'Explored!' ? '#4169E1' : '#FF8000';
        const polyline = L.polyline(latlngs, {
          color,
          weight: 3,
          opacity: 0.8,
        }).addTo(map);

        polyline.bindPopup(
          `<b>${trail.name}</b><br/>${trail.length_km?.toFixed(1) ?? '?'} km<br/>${trail.status}`,
        );
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
