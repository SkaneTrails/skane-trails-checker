import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    pool: process.platform === 'win32' ? 'forks' : 'threads',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.*',
        '**/test/**',
        // Barrel re-exports
        '**/index.ts',
        // Pure types — no runtime code
        'lib/types.ts',
        // Firebase config — environment-dependent initialization
        'lib/firebase.ts',
        // Service worker registration — platform-specific side effect
        'lib/register-sw.ts',
        // Leaflet CSS injection — side effect only
        'lib/inject-css.ts',
        // Static lookup tables — no logic
        'lib/foraging-colors.ts',
        'lib/place-colors.ts',
        // Theme constants — static values only
        'lib/theme/**',
        // i18n locale data — static translation strings
        'lib/i18n/locales/**',
        'lib/i18n/language-state.ts',
        'lib/i18n/translate.ts',
        // Query provider — singleton QueryClient configuration
        'lib/query-provider.tsx',
        // Firebase auth — depends on Firebase SDK, expo-auth-session
        'lib/hooks/use-auth.tsx',
        // Hike groups hook — thin React Query wrapper
        'lib/hooks/use-hike-groups.ts',
        // Hike groups API — thin fetch wrapper
        'lib/api/hike-groups.ts',
        // Map components — Leaflet dependency, heavy DOM interaction
        'components/ForagingMap.tsx',
        'components/TrailMap.tsx',
        'components/UnifiedMap.web.tsx',
        // Platform-specific — require native runtime or Leaflet DOM, cannot test in jsdom
        'components/UnifiedMap.native.tsx',
        'components/TrackingControls.native.tsx',
        'components/TrackingControls.web.tsx',
        // Web stub — no-op re-exports, no logic to test
        'lib/tracking-service.web.ts',
        // Presentation-only components — no logic beyond props
        'components/BottomSheet.tsx',
        'components/Button.tsx',
        'components/Chip.tsx',
        'components/ContentCard.tsx',
        'components/EmptyState.tsx',
        'components/FloatingButton.tsx',
        'components/FloatingCardOverlay.tsx',
        'components/FormField.tsx',
        'components/GlassCard.tsx',
        'components/GoogleLogo.tsx',
        'components/LayerToggle.tsx',
        'components/PlaceCard.tsx',
        'components/PlaceCategoryIcon.tsx',
        'components/ScreenLayout.tsx',
        'components/StatCard.tsx',
        'components/StatusBadge.tsx',
        'components/TabIcon.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'react-native': path.resolve(__dirname, 'test/react-native-mock.tsx'),
    },
  },
});
