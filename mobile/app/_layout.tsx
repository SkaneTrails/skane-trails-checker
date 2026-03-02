import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/hooks/use-auth';
import { QueryProvider } from '@/lib/query-provider';
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
          title: 'Trail Details',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="upload"
        options={{
          title: 'Upload GPX',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const theme = getTheme(defaultThemeId);

  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <QueryProvider>
          <AppStack />
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
