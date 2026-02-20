import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1a5e2a',
        tabBarInactiveTintColor: '#888',
        headerStyle: { backgroundColor: '#1a5e2a' },
        headerTintColor: '#fff',
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
