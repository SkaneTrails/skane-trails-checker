/**
 * Theme registry.
 *
 * To add a theme: create a new file in themes/, import it here, add to the map.
 */

import type { ThemeDefinition } from '../theme-context';
import { outdoorTheme } from './outdoor';

export const themes: Record<string, ThemeDefinition> = {
  outdoor: outdoorTheme,
};

export const defaultThemeId = 'outdoor';

export function getTheme(id: string): ThemeDefinition {
  return themes[id] ?? themes[defaultThemeId];
}
