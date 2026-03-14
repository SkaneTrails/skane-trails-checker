/**
 * Settings context for app-wide settings.
 *
 * Language and theme are device-local (AsyncStorage).
 * Hike group data is fetched from the API separately via hooks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppLanguage } from './i18n/language-state';
import { setCurrentLanguage } from './i18n/language-state';

export type { AppLanguage } from './i18n/language-state';

const STORAGE_KEY = '@skane_trails_settings';

export const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Svenska' },
];

const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'sv'];

const isSupportedLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_LANGUAGES.includes(value as AppLanguage);

/** Categories shown by default on map and places tab (hiking essentials). */
export const DEFAULT_PLACE_CATEGORIES = ['parkering', 'vatten', 'toalett'];

interface Settings {
  language: AppLanguage;
  themeId: string;
  enabledPlaceCategories: string[];
}

interface SettingsContextType {
  language: AppLanguage;
  themeId: string;
  enabledPlaceCategories: string[];
  isLoading: boolean;
  setLanguage: (language: AppLanguage) => void;
  setEnabledPlaceCategories: (categories: string[]) => void;
  togglePlaceCategory: (slug: string) => void;
}

const defaultSettings: Settings = {
  language: 'en',
  themeId: 'outdoor',
  enabledPlaceCategories: DEFAULT_PLACE_CATEGORIES,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
            language:
              typeof parsed.language === 'string' && isSupportedLanguage(parsed.language)
                ? parsed.language
                : 'en',
            themeId: parsed.themeId ?? 'outdoor',
            enabledPlaceCategories: Array.isArray(parsed.enabledPlaceCategories)
              ? parsed.enabledPlaceCategories
              : DEFAULT_PLACE_CATEGORIES,
          });
        }
      } catch {
        // Use defaults on error
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Keep module-level language in sync for non-React consumers
  useEffect(() => {
    setCurrentLanguage(settings.language);
  }, [settings.language]);

  const setLanguage = useCallback((language: AppLanguage) => {
    setSettings((prev) => {
      const updated = { ...prev, language };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setEnabledPlaceCategories = useCallback((categories: string[]) => {
    setSettings((prev) => {
      const updated = { ...prev, enabledPlaceCategories: categories };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const togglePlaceCategory = useCallback((slug: string) => {
    setSettings((prev) => {
      const enabled = prev.enabledPlaceCategories.includes(slug)
        ? prev.enabledPlaceCategories.filter((s) => s !== slug)
        : [...prev.enabledPlaceCategories, slug];
      const updated = { ...prev, enabledPlaceCategories: enabled };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo<SettingsContextType>(
    () => ({
      language: settings.language,
      themeId: settings.themeId,
      enabledPlaceCategories: settings.enabledPlaceCategories,
      isLoading,
      setLanguage,
      setEnabledPlaceCategories,
      togglePlaceCategory,
    }),
    [settings, isLoading, setLanguage, setEnabledPlaceCategories, togglePlaceCategory],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
};
