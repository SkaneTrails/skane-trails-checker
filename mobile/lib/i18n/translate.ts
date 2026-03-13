/**
 * Pure translation utilities — no React, no settings-context dependency.
 *
 * Extracted to avoid circular dependencies.
 */

import type { AppLanguage } from '@/lib/i18n/language-state';
import type { Translations } from './locales/en';
import en from './locales/en';
import sv from './locales/sv';

export const locales: Record<AppLanguage, Translations> = { en, sv };

/**
 * Resolve a dot-separated key path (e.g. "trail.distance") to its
 * value in the given translations object. Returns undefined when the
 * path does not exist.
 */
export const resolve = (obj: unknown, path: string): string | undefined => {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
};

/**
 * Replace {{variable}} placeholders with values from params.
 */
export const interpolate = (
  template: string,
  params?: Record<string, string | number>,
): string => {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] != null ? String(params[key]) : `{{${key}}}`,
  );
};

export type TFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Standalone translate function for use outside React component tree.
 */
export const translateStandalone = (
  language: AppLanguage,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const translations = locales[language] ?? en;
  const value = resolve(translations, key);
  if (value != null && value !== '') {
    return interpolate(value, params);
  }
  const fallback = resolve(en, key);
  if (fallback != null && fallback !== '') {
    return interpolate(fallback, params);
  }
  return key;
};
