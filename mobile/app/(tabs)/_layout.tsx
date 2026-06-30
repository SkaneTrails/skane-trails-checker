import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTheme } from '@/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const { data: currentUser, isLoading: userLoading, error } = useCurrentUser({
    enabled: !loading && !!user,
  });

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

  // Single-screen layout: only the map (index.tsx) lives here.
  // All other content is accessible via hamburger menu drawers/modals.
  return <Slot />;
}
