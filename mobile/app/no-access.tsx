/**
 * No access screen — shown to authenticated users without group membership.
 * Provides sign-out option and explains the situation.
 */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Alert, ActivityIndicator, Platform, Text, View } from 'react-native';
import { Button } from '@/components';
import { useAuth } from '@/lib/hooks/use-auth';
import { useCurrentUser } from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export default function NoAccessScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { t } = useTranslation();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser({
    enabled: !loading && !!user,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/sign-in');
    } catch {
      if (Platform.OS === 'web') {
        window.alert(t('noAccess.failedToSignOut'));
      } else {
        Alert.alert(t('common.error'), t('noAccess.failedToSignOut'));
      }
    }
  };

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser?.group_id || currentUser?.role === 'superuser') {
    return <Redirect href="/(tabs)" />;
  }

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

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 96,
          height: 96,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name="lock-closed" size={48} color={colors.text.primary} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: fontSize.xxl,
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
          marginBottom: spacing.sm,
        }}
      >
        {t('noAccess.title')}
      </Text>

      {/* Signed-in email */}
      <Text
        style={{
          color: colors.text.secondary,
          textAlign: 'center',
          fontSize: fontSize.lg,
          marginBottom: spacing.xs,
        }}
      >
        {t('noAccess.signedInAs')}
      </Text>
      <Text
        style={{
          color: colors.text.primary,
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.lg,
          marginBottom: spacing.sm,
        }}
      >
        {user?.email}
      </Text>

      {/* Explanation */}
      <Text
        style={{
          color: colors.text.secondary,
          textAlign: 'center',
          fontSize: fontSize.md,
          lineHeight: 24,
          marginBottom: spacing.xl,
        }}
      >
        {t('noAccess.notInGroup')}
        {'\n\n'}
        {t('noAccess.askAdmin')}
      </Text>

      {/* Sign Out Button */}
      <Button title={t('noAccess.signOutButton')} onPress={handleSignOut} variant="danger" />

      {/* Footer hint */}
      <Text
        style={{
          color: colors.text.muted,
          fontSize: fontSize.sm,
          textAlign: 'center',
          marginTop: spacing.xl,
        }}
      >
        {t('noAccess.contactAdmin')}
      </Text>
    </View>
  );
}
