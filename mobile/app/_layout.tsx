import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { QueryProvider } from '@/lib/query-provider';
import { registerServiceWorker } from '@/lib/register-sw';
import { SettingsProvider } from '@/lib/settings-context';
import { defaultThemeId, getTheme, ThemeProvider, useTheme } from '@/lib/theme';

function useProtectedRoute() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const onSignIn = segments[0] === 'sign-in';

    if (!user && !onSignIn) {
      router.replace('/sign-in');
    } else if (user && onSignIn) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  return { loading };
}

function AppStack() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { loading } = useProtectedRoute();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="trail/[id]"
        options={{
          title: t('trail.title'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="upload"
        options={{
          title: t('upload.title'),
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="group-settings"
        options={{
          title: t('settings.groupSettings'),
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const theme = getTheme(defaultThemeId);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <SettingsProvider>
        <AuthProvider>
          <QueryProvider>
            <AppStack />
          </QueryProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
