// Global test setup
// react-native is aliased to test/react-native-mock.tsx in vitest.config.ts
import '@testing-library/jest-dom';

// jsdom v29+ uses a stricter CSSStyleDeclaration Proxy that rejects
// numeric-indexed property writes (style[0] = ''). React DOM internally
// uses these when applying React Native Web styles. Patch the prototype
// to accept all property writes via setProperty/removeProperty fallback.
const originalStyleSetProperty = CSSStyleDeclaration.prototype.setProperty;
Object.defineProperty(CSSStyleDeclaration.prototype, 'setProperty', {
  value: originalStyleSetProperty,
  writable: true,
  configurable: true,
});
// Ensure numeric-indexed assignments don't throw by returning a permissive proxy
const origCreateElement = document.createElement.bind(document);
document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
  const el = origCreateElement(tagName, options);
  const style = el.style as CSSStyleDeclaration;
  return new Proxy(el, {
    get(target, prop, receiver) {
      if (prop === 'style') {
        return new Proxy(style, {
          set(sTarget, sProp, sValue) {
            if (typeof sProp === 'string' && /^\d+$/.test(sProp)) {
              return true; // silently accept numeric-indexed writes
            }
            try {
              (sTarget as Record<string | symbol, unknown>)[sProp] = sValue;
            } catch {
              return true; // swallow proxy rejections for unknown CSS props
            }
            return true;
          },
          get(sTarget, sProp, sReceiver) {
            const val = Reflect.get(sTarget, sProp, sReceiver);
            return typeof val === 'function' ? val.bind(sTarget) : val;
          },
        });
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
}) as typeof document.createElement;

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
