import type { ColorTokens } from './theme/colors';
import { animation, blur, borderRadius } from './theme/layout';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';

const LOCATE_CSS = 'https://unpkg.com/leaflet.locatecontrol@0.89.0/dist/L.Control.Locate.min.css';
const LOCATE_CSS_INTEGRITY = 'sha256-O+3YJj36sHCEz79vulGAW3a86wg5jUdaBjJxZo4RgjU=';

/** Leaflet control button dimensions (intrinsic to control UX, not design tokens) */
const LEAFLET_BUTTON_SIZE = 36;
const LEAFLET_ICON_SIZE = 18;
const LEAFLET_ICON_LINE_HEIGHT = 30;
const LEAFLET_CONTROL_RADIUS = borderRadius.sm + 2;

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

let glassInjected = false;

export function injectGlassCSS(colors: ColorTokens): void {
  if (glassInjected) return;
  glassInjected = true;

  const { glass, text, shadow } = colors;

  const style = document.createElement('style');
  style.textContent = `
    /* Slide-down animation for glass cards */
    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Leaflet glass control overrides */
    .leaflet-control-zoom a,
    .leaflet-control-locate a {
      background: ${glass.background} !important;
      backdrop-filter: blur(${blur.md}px) !important;
      -webkit-backdrop-filter: blur(${blur.md}px) !important;
      border: none !important;
      border-bottom: 1px solid ${shadow} !important;
      color: ${text.primary} !important;
      font-weight: 300 !important;
      font-size: ${LEAFLET_ICON_SIZE}px !important;
      line-height: ${LEAFLET_ICON_LINE_HEIGHT}px !important;
      width: ${LEAFLET_BUTTON_SIZE}px !important;
      height: ${LEAFLET_BUTTON_SIZE}px !important;
      transition: background ${animation.duration.fast}ms ${animation.easing.ease};
    }
    .leaflet-control-zoom a:last-child {
      border-bottom: none !important;
    }
    .leaflet-control-zoom a:hover,
    .leaflet-control-locate a:hover {
      background: rgba(255,255,255,0.92) !important;
    }
    .leaflet-control-zoom {
      border: none !important;
      border-radius: ${LEAFLET_CONTROL_RADIUS}px !important;
      overflow: hidden;
      box-shadow: 0 2px 12px ${shadow};
    }
    .leaflet-control-locate {
      border: none !important;
      border-radius: ${LEAFLET_CONTROL_RADIUS}px !important;
      overflow: hidden;
      box-shadow: 0 2px 12px ${shadow};
    }
    .leaflet-control-attribution {
      background: rgba(255,255,255,0.5) !important;
      backdrop-filter: blur(${blur.sm}px) !important;
      -webkit-backdrop-filter: blur(${blur.sm}px) !important;
      font-size: 9px !important;
      border-radius: 6px 0 0 0 !important;
      padding: 2px 6px !important;
      color: ${text.muted} !important;
    }
    .leaflet-control-attribution a {
      color: ${text.muted} !important;
    }

    /* Trail polyline glow */
    .trail-glow {
      filter: blur(3px);
      opacity: 0.3;
    }

    /* Foraging dot marker — no background/border on container */
    .foraging-dot {
      background: none !important;
      border: none !important;
      box-shadow: none !important;
    }
    .foraging-dot:hover div {
      transform: scale(1.3);
    }

    /* Place dot marker — no background/border on container */
    .place-dot {
      background: none !important;
      border: none !important;
      box-shadow: none !important;
    }
    .place-dot:hover div {
      transform: scale(1.3);
    }

    /* Glass tab bar for web — floating pill */
    [role="tablist"] {
      border-top-width: 0 !important;
    }

    /* Push bottom-right map controls above the floating tab bar */
    .leaflet-bottom.leaflet-right {
      bottom: 80px !important;
    }
    /* Add gap between zoom and locate controls */
    .leaflet-control-locate {
      margin-bottom: 6px !important;
    }

    /* Smooth transitions */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `;
  document.head.appendChild(style);
}

export function injectLeafletCSS(colors: ColorTokens): void {
  injectLink(LEAFLET_CSS, LEAFLET_CSS_INTEGRITY);
  injectLink(LOCATE_CSS, LOCATE_CSS_INTEGRITY);
  injectGlassCSS(colors);
}
