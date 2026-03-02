import { useEffect, useRef } from 'react';
import type { Trail } from '@/lib/types';

// Leaflet CSS is loaded dynamically to avoid SSR/RN issues
function loadLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

function loadLocateControlCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-locate-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-locate-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet.locatecontrol@0.88.0/dist/L.Control.Locate.min.css';
  document.head.appendChild(link);
}

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
    loadLeafletCSS();
    loadLocateControlCSS();

    // Dynamically import leaflet (web only)
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      const { LocateControl } = await import('leaflet.locatecontrol');

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
      const bounds: L.LatLngBounds[] = [];
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

        bounds.push(polyline.getBounds());
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
