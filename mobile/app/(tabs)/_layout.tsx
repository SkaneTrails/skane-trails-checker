import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { TabIcon } from '@/components/TabIcon';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { blur, borderRadius, spacing, useTheme } from '@/lib/theme';
import { cssShadow } from '@/lib/theme/styles';

export default function TabLayout() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { isLoading: userLoading, error } = useCurrentUser({
    enabled: !loading && !!user,
  });
  const isWeb = Platform.OS === 'web';

  if (loading || userLoading) {
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

  if (error instanceof ApiClientError && error.status === 403) {
    return <Redirect href="/no-access" />;
  }

  if (error instanceof ApiClientError && error.status === 401) {
    return <Redirect href="/sign-in" />;
  }

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.muted,
        sceneStyle: isWeb
          ? ({ backgroundColor: 'transparent' } as any)
          : { backgroundColor: colors.background },
        tabBarStyle: isWeb
          ? ({
              position: 'absolute',
              bottom: spacing.lg,
              left: '5%',
              right: '5%',
              height: 58,
              borderTopWidth: 0,
              elevation: 0,
              backgroundColor: colors.glass.background,
              borderRadius: borderRadius['2xl'] + 1,
              backdropFilter: `blur(${blur.lg}px)`,
              WebkitBackdropFilter: `blur(${blur.lg}px)`,
              boxShadow: cssShadow(shadows, 'card'),
              border: `1px solid ${colors.glass.border}`,
              overflow: 'hidden',
            } as any)
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 56,
              paddingBottom: spacing.xs,
            },
        tabBarItemStyle: {
          paddingVertical: spacing.sm,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.map'),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trails"
        options={{
          title: t('tabs.trails'),
          tabBarIcon: ({ color }) => <TabIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="foraging"
        options={{
          title: t('tabs.foraging'),
          tabBarIcon: ({ color }) => <TabIcon name="leaf" color={color} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: t('tabs.places'),
          tabBarIcon: ({ color }) => <TabIcon name="pin" color={color} />,
        }}
      />

    </Tabs>
  );

  if (!isWeb) return tabs;

  return (
    <View
      style={
        {
          flex: 1,
          background: colors.webBackground,
        } as any
      }
    >
      {tabs}
    </View>
  );
}
