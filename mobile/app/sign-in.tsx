/**
 * Sign-in screen with Google authentication.
 *
 * Redirects to main tabs when authenticated.
 * In dev mode without Firebase config, auto-grants a mock user.
 */

import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ScreenLayout } from '@/components';
import { GoogleLogo } from '@/components/GoogleLogo';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user, loading, error, signIn, signOut } = useAuth();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={{
              marginTop: spacing.lg,
              color: colors.text.secondary,
              fontSize: fontSize.md,
            }}
          >
            {t('common.loading')}
          </Text>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => ({
              position: 'absolute',
              bottom: 48,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.muted,
                fontSize: fontSize.sm,
                textDecorationLine: 'underline',
              }}
            >
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        {/* Brand */}
        <Text
          style={{
            fontSize: 36,
            fontWeight: fontWeight.bold,
            color: colors.primary,
            marginBottom: spacing.sm,
          }}
        >
          Skåne Trails
        </Text>
        <Text
          style={{
            color: colors.text.secondary,
            textAlign: 'center',
            fontSize: fontSize.lg,
            marginBottom: 64,
          }}
        >
          {t('signIn.subtitle')}
        </Text>

        {/* Error */}
        {error && (
          <View
            style={{
              backgroundColor: colors.errorBg,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              marginBottom: spacing.xl,
              width: '100%',
            }}
          >
            <Text
              style={{
                color: colors.error,
                textAlign: 'center',
                fontSize: fontSize.md,
              }}
            >
              {error}
            </Text>
          </View>
        )}

        {/* Google Sign-In Button */}
        <Pressable
          onPress={signIn}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryDark : colors.primary,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: 320,
          })}
        >
          <GoogleLogo size={20} />
          <Text
            style={{
              color: colors.text.inverse,
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.lg,
              marginLeft: spacing.md,
            }}
          >
            {t('signIn.continueWithGoogle')}
          </Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View
        style={{
          paddingBottom: 48,
          paddingHorizontal: spacing.xl,
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Text
          style={{
            color: colors.text.muted,
            fontSize: fontSize.sm,
            textAlign: 'center',
          }}
        >
          {t('signIn.syncNote')}
        </Text>
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => ({
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.muted,
              fontSize: fontSize.sm,
              textDecorationLine: 'underline',
            }}
          >
            Sign Out
          </Text>
        </Pressable>
      </View>
    </ScreenLayout>
  );
}
