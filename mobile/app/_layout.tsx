import { Stack } from 'expo-router';
import { QueryProvider } from '@/lib/query-provider';

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a5e2a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
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
    </QueryProvider>
  );
}
