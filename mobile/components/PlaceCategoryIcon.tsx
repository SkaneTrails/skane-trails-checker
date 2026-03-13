/**
 * Flat line icons for place categories.
 *
 * Stroke-based SVG icons matching the minimalistic TabIcon style.
 * Each category has a unique icon colored by the place-colors palette.
 */

import { Platform, View } from 'react-native';
import { placeCategoryColor } from '@/lib/place-colors';

const ICON_PATHS: Record<string, string> = {
  parkering:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M9 8h3.5a2.5 2.5 0 0 1 0 5H9V8z M9 13v3',
  vatten: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z',
  'lagerplats-med-vindskydd':
    'M3 20h18 M5 20v-6l7-4 7 4v6 M9 20v-4h6v4',
  toalett:
    'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8 10h8l-1 5h-6l-1-5z M9 15l-1 7 M15 15l1 7 M12 15v7',
  kollektivtrafik:
    'M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M4 11h16 M8.5 19.5L7 17 M15.5 19.5L17 17 M8.5 14.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z M15.5 14.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  boende:
    'M3 21h18 M3 10l9-7 9 7 M5 10v11 M19 10v11 M9 21v-6h6v6',
  badplats:
    'M2 16c1-1 2.5-1 3.5 0s2.5 1 3.5 0 2.5-1 3.5 0 2.5 1 3.5 0 2.5-1 3.5 0 M2 20c1-1 2.5-1 3.5 0s2.5 1 3.5 0 2.5-1 3.5 0 2.5 1 3.5 0 2.5-1 3.5 0 M7 12V8a5 5 0 0 1 10 0v4',
  'ata-dricka':
    'M3 4h18 M12 4v8 M4 4c0 4 2 8 8 8s8-4 8-8 M8 20h8 M12 12v8',
  livsmedelgardsbutik:
    'M3 9l2-5h14l2 5 M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9 M9 9v4a3 3 0 0 0 6 0V9',
  sevardhet:
    'M14.5 4h-5L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2.5-3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  aktivitet:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  turistinformation:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
  konst:
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  naturlekplats:
    'M12 3v19 M5 8c0 0 3-2 7-2s7 2 7 2 M7 13c0 0 2-1.5 5-1.5s5 1.5 5 1.5 M9 18c0 0 1.5-1 3-1s3 1 3 1',
};

const FALLBACK_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';

interface PlaceCategoryIconProps {
  slug: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function PlaceCategoryIcon({
  slug,
  size = 16,
  strokeWidth = 1.5,
  color,
}: PlaceCategoryIconProps) {
  const iconColor = color ?? placeCategoryColor(slug);

  if (Platform.OS !== 'web') {
    return <View style={{ width: size, height: size }} />;
  }

  const pathData = ICON_PATHS[slug] ?? FALLBACK_PATH;

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG icon paths, no user input
      dangerouslySetInnerHTML={{
        __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${pathData
          .split(' M')
          .map((d, i) => `<path d="${i === 0 ? d : `M${d}`}"/>`)
          .join('')}</svg>`,
      }}
    />
  );
}
