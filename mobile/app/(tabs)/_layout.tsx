import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { fontSize, spacing, useTheme } from '@/lib/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const { data: currentUser, isLoading: userLoading, error, refetch } = useCurrentUser({
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

  if (error) {
    return <ApiErrorFallback error={error} onRetry={() => refetch()} />;
  }

  // Single-screen layout: only the map (index.tsx) lives here.
  // All other content is accessible via hamburger menu drawers/modals.
  return <Slot />;
}

function ApiErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const status = error instanceof ApiClientError ? error.status : undefined;
  const isUnavailable = status === 503 || !(error instanceof ApiClientError);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text style={{ fontSize: fontSize.lg, color: colors.text.primary, textAlign: 'center' }}>
        {isUnavailable ? t('common.serverUnavailable') : t('common.error')}
      </Text>
      <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, textAlign: 'center' }}>
        {isUnavailable
          ? t('common.serverUnavailableDetail')
          : error.message}
      </Text>
      <Button title={t('common.retry')} onPress={onRetry} />
    </View>
  );
}
