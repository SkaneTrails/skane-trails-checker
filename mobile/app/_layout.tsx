import { Stack } from 'expo-router';
import { AuthProvider } from '@/lib/hooks/use-auth';
import { QueryProvider } from '@/lib/query-provider';
import { defaultThemeId, getTheme, ThemeProvider, useTheme } from '@/lib/theme';

function AppStack() {
  const { colors } = useTheme();

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
