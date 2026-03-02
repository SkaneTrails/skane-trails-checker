import { Tabs } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarLabel: '🗺️ Map',
        }}
      />
      <Tabs.Screen
        name="trails"
        options={{
          title: 'Trails',
          tabBarLabel: '🥾 Trails',
        }}
      />
      <Tabs.Screen
        name="foraging"
        options={{
          title: 'Foraging',
          tabBarLabel: '🍄 Foraging',
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Places',
          tabBarLabel: '📍 Places',
        }}
      />
    </Tabs>
  );
}
