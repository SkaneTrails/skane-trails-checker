const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_INTEGRITY =
  'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

const LOCATE_CSS =
  'https://unpkg.com/leaflet.locatecontrol@0.89.0/dist/L.Control.Locate.min.css';
const LOCATE_CSS_INTEGRITY =
  'sha256-O+3YJj36sHCEz79vulGAW3a86wg5jUdaBjJxZo4RgjU=';

const injected = new Set<string>();

function injectLink(href: string, integrity: string): void {
  if (injected.has(href)) return;
  injected.add(href);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.integrity = integrity;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

export function injectLeafletCSS(): void {
  injectLink(LEAFLET_CSS, LEAFLET_CSS_INTEGRITY);
  injectLink(LOCATE_CSS, LOCATE_CSS_INTEGRITY);
}
