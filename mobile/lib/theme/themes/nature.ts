/**
 * Nature theme — "Forest & Trails"
 *
 * Deep forest greens with warm earth tones, inspired by the Skåne
 * countryside. This is the default (and currently only) theme.
 */

import { natureColors } from '../colors';
import type { ThemeDefinition } from '../theme-context';

export const natureTheme: ThemeDefinition = {
  id: 'nature',
  name: 'Forest & Trails',
  colors: natureColors,
};
