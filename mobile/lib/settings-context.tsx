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
import { DEFAULT_COMPLETED_COLOR, DEFAULT_PLANNED_COLOR } from './trail-colors';

export type { AppLanguage } from './i18n/language-state';

/** GPS tracking mode — affects battery consumption and track precision. */
export type GpsMode = 'balanced' | 'high_precision';

export const GPS_MODES: { code: GpsMode; labelKey: string }[] = [
  { code: 'balanced', labelKey: 'settings.gpsBalanced' },
  { code: 'high_precision', labelKey: 'settings.gpsHighPrecision' },
];

const STORAGE_KEY = '@skane_trails_settings';

export const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Svenska' },
];

const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'sv'];

const isSupportedLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_LANGUAGES.includes(value as AppLanguage);

const isSupportedGpsMode = (value: string): value is GpsMode =>
  value === 'balanced' || value === 'high_precision';

/** Categories shown by default on map and places tab (hiking essentials). */
export const DEFAULT_PLACE_CATEGORIES = ['parkering', 'vatten', 'toalett'];

interface Settings {
  language: AppLanguage;
  themeId: string;
  enabledPlaceCategories: string[];
  defaultPlannedColor: string;
  defaultCompletedColor: string;
  gpsMode: GpsMode;
}

interface SettingsContextType {
  language: AppLanguage;
  themeId: string;
  enabledPlaceCategories: string[];
  defaultPlannedColor: string;
  defaultCompletedColor: string;
  gpsMode: GpsMode;
  isLoading: boolean;
  setLanguage: (language: AppLanguage) => void;
  setEnabledPlaceCategories: (categories: string[]) => void;
  togglePlaceCategory: (slug: string) => void;
  setDefaultPlannedColor: (color: string) => void;
  setDefaultCompletedColor: (color: string) => void;
  setGpsMode: (mode: GpsMode) => void;
}

const defaultSettings: Settings = {
  language: 'en',
  themeId: 'outdoor',
  enabledPlaceCategories: DEFAULT_PLACE_CATEGORIES,
  defaultPlannedColor: DEFAULT_PLANNED_COLOR,
  defaultCompletedColor: DEFAULT_COMPLETED_COLOR,
  gpsMode: 'balanced',
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
            defaultPlannedColor:
              typeof parsed.defaultPlannedColor === 'string'
                ? parsed.defaultPlannedColor
                : DEFAULT_PLANNED_COLOR,
            defaultCompletedColor:
              typeof parsed.defaultCompletedColor === 'string'
                ? parsed.defaultCompletedColor
                : DEFAULT_COMPLETED_COLOR,
            gpsMode:
              typeof parsed.gpsMode === 'string' && isSupportedGpsMode(parsed.gpsMode)
                ? parsed.gpsMode
                : 'balanced',
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

  const setDefaultPlannedColor = useCallback((color: string) => {
    setSettings((prev) => {
      const updated = { ...prev, defaultPlannedColor: color };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setDefaultCompletedColor = useCallback((color: string) => {
    setSettings((prev) => {
      const updated = { ...prev, defaultCompletedColor: color };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setGpsMode = useCallback((mode: GpsMode) => {
    setSettings((prev) => {
      const updated = { ...prev, gpsMode: mode };
      // Best-effort persistence — UI state updates immediately regardless of storage success
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const value = useMemo<SettingsContextType>(
    () => ({
      language: settings.language,
      themeId: settings.themeId,
      enabledPlaceCategories: settings.enabledPlaceCategories,
      defaultPlannedColor: settings.defaultPlannedColor,
      defaultCompletedColor: settings.defaultCompletedColor,
      gpsMode: settings.gpsMode,
      isLoading,
      setLanguage,
      setEnabledPlaceCategories,
      togglePlaceCategory,
      setDefaultPlannedColor,
      setDefaultCompletedColor,
      setGpsMode,
    }),
    [settings, isLoading, setLanguage, setEnabledPlaceCategories, togglePlaceCategory, setDefaultPlannedColor, setDefaultCompletedColor, setGpsMode],
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
