const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LOCATE_CSS =
  'https://unpkg.com/leaflet.locatecontrol@0.89.0/dist/L.Control.Locate.min.css';

const injected = new Set<string>();

function injectLink(href: string): void {
  if (injected.has(href)) return;
  injected.add(href);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function injectLeafletCSS(): void {
  injectLink(LEAFLET_CSS);
  injectLink(LOCATE_CSS);
}
