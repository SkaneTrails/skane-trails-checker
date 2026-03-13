import { Tabs } from 'expo-router';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

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
          title: t('tabs.map'),
          tabBarLabel: `🗺️ ${t('tabs.map')}`,
        }}
      />
      <Tabs.Screen
        name="trails"
        options={{
          title: t('tabs.trails'),
          tabBarLabel: `🥾 ${t('tabs.trails')}`,
        }}
      />
      <Tabs.Screen
        name="foraging"
        options={{
          title: t('tabs.foraging'),
          tabBarLabel: `🍄 ${t('tabs.foraging')}`,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: t('tabs.places'),
          tabBarLabel: `📍 ${t('tabs.places')}`,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarLabel: `⚙️ ${t('settings.title')}`,
        }}
      />
    </Tabs>
  );
}
