/**
 * Settings context for app-wide settings.
 *
 * Language and theme are device-local (AsyncStorage).
 * Hike group data is fetched from the API separately via hooks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppLanguage } from './i18n/language-state';
import { setCurrentLanguage } from './i18n/language-state';

export type { AppLanguage } from './i18n/language-state';

const STORAGE_KEY = '@skane_trails_settings';

export const LANGUAGES: { code: AppLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
];

const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'sv'];

const isSupportedLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_LANGUAGES.includes(value as AppLanguage);

interface Settings {
  language: AppLanguage;
  themeId: string;
}

interface SettingsContextType {
  language: AppLanguage;
  themeId: string;
  isLoading: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
}

const defaultSettings: Settings = {
  language: 'en',
  themeId: 'outdoor',
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
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
              typeof parsed.language === 'string' &&
              isSupportedLanguage(parsed.language)
                ? parsed.language
                : 'en',
            themeId: parsed.themeId ?? 'outdoor',
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

  const setLanguage = useCallback(
    async (language: AppLanguage) => {
      const updated = { ...settings, language };
      setSettings(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [settings],
  );

  const value = useMemo<SettingsContextType>(
    () => ({
      language: settings.language,
      themeId: settings.themeId,
      isLoading,
      setLanguage,
    }),
    [settings, isLoading, setLanguage],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
};
