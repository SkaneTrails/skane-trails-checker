import { Stack } from 'expo-router';
import { QueryProvider } from '@/lib/query-provider';
import { fontWeight, natureTheme, ThemeProvider, useTheme } from '@/lib/theme';

export default function RootLayout() {
  return (
    <QueryProvider>
      <ThemeProvider theme={natureTheme}>
        <NavigationStack />
      </ThemeProvider>
    </QueryProvider>
  );
}

function NavigationStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: { fontWeight: fontWeight.bold },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="trail/[id]"
        options={{
          title: 'Trail Details',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
