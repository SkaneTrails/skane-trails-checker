/**
 * Lightweight line icons for tab bar and navigation.
 *
 * Uses inline SVG paths for crisp, minimalistic outlined icons.
 * Stroke-based design: thin lines with adjustable weight.
 */

import { Platform, View } from 'react-native';

type IconName =
  | 'map'
  | 'compass'
  | 'leaf'
  | 'pin'
  | 'settings'
  | 'close'
  | 'upload'
  | 'location'
  | 'check'
  | 'circle'
  | 'edit'
  | 'trash'
  | 'file'
  | 'globe'
  | 'menu'
  | 'play'
  | 'shield'
  | 'chevron-forward'
  | 'eye'
  | 'eye-off';

interface TabIconProps {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
}

const paths: Record<IconName, string> = {
  map: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13',
  compass:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  leaf: 'M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 0-8 2-13 7z M6.5 12.5C8 14 10 15 12 15',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  settings:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  close: 'M18 6L6 18 M6 6l12 12',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  location: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  check: 'M20 6L9 17l-5-5',
  circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  edit: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  play: 'M5 3l14 9-14 9V3z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'chevron-forward': 'M9 18l6-6-6-6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off':
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19 M1 1l22 22 M14.12 14.12a3 3 0 1 1-4.24-4.24',
};

export function TabIcon({ name, color, size = 22, strokeWidth = 1.5 }: TabIconProps) {
  if (Platform.OS !== 'web') {
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG icon paths, no user input
      dangerouslySetInnerHTML={{
        __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths[
          name
        ]
          .split(' M')
          .map((d, i) => `<path d="${i === 0 ? d : `M${d}`}"/>`)
          .join('')}</svg>`,
      }}
    />
  );
}
