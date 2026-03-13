// Global test setup
// react-native is aliased to test/react-native-mock.tsx in vitest.config.ts
import '@testing-library/jest-dom';

// Mock @react-native-async-storage/async-storage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

// Mock i18n — returns the key itself so tests don't depend on locale strings
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en' as const,
  }),
}));

// Mock expo-router
vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: 'Screen',
  },
  Tabs: {
    Screen: 'Screen',
  },
  Link: 'Link',
}));
