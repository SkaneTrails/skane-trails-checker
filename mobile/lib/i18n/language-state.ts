/**
 * Module-level language state for non-React consumers.
 *
 * Extracted to its own module to avoid circular dependencies.
 */

export type AppLanguage = 'en' | 'sv';

let _currentLanguage: AppLanguage = 'en';

export const getCurrentLanguage = (): AppLanguage => _currentLanguage;

export const setCurrentLanguage = (lang: AppLanguage): void => {
  _currentLanguage = lang;
};
