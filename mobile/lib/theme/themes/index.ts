/**
 * Theme registry — auto-built from individual theme files.
 *
 * To add a theme: create a new file in this folder, then add one import
 * and one array entry below. To remove: delete the file and its entry.
 */

import type { ThemeDefinition } from '../theme-context';
import { natureTheme } from './nature';

/** Ordered list of all registered themes. First entry is the default. */
const allThemes: ThemeDefinition[] = [natureTheme];

/** Theme lookup by id. */
export const themes: Record<string, ThemeDefinition> = Object.fromEntries(
  allThemes.map((t) => [t.id, t]),
);

/** Registry key of the default theme (first in the list). */
export const defaultThemeId: string = allThemes[0].id;

/** Type guard: is `value` a registered theme id? */
export const isThemeId = (value: string): boolean => value in themes;
