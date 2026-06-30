/**
 * i18n module — provides the useTranslation() hook.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   t('common.cancel')               // → "Cancel"
 *   t('trail.deleteConfirm', { name: 'Skåneleden' })
 *     // → 'Delete "Skåneleden"? This cannot be undone.'
 */

import { useCallback, useMemo } from 'react';
import { useSettings } from '@/lib/settings-context';
import en from './locales/en';
import { interpolate, locales, resolve, type TFunction } from './translate';

export type { TFunction };
export { translateStandalone } from './translate';

/**
 * React hook that returns a t() function bound to the current app language.
 *
 * Falls back to English when the key is missing or empty in the active locale.
 * If also missing from English, returns the key itself.
 */
export const useTranslation = () => {
  const { language } = useSettings();

  const translations = useMemo(() => locales[language] ?? en, [language]);

  const t: TFunction = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = resolve(translations, key);
      if (value != null && value !== '') {
        return interpolate(value, params);
      }
      const fallback = resolve(en, key);
      if (fallback != null && fallback !== '') {
        return interpolate(fallback, params);
      }
      return key;
    },
    [translations],
  );

  return { t, language };
};
