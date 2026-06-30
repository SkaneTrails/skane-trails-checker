/**
 * Sign-in screen with Google authentication.
 *
 * Redirects to main tabs when authenticated.
 * Glass card centered on a clean background.
 */

import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenLayout } from '@/components';
import { GoogleLogo } from '@/components/GoogleLogo';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';

export default function SignInScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { user, loading, error, signIn, signOut } = useAuth();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading) {
    return (
      <ScreenLayout tabGap={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('common.loading')}
          </Text>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOutLink, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.signOutText, { color: colors.text.muted }]}>Sign Out</Text>
          </Pressable>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout tabGap={false}>
      <View style={styles.center}>
        <View style={[styles.card, glassCard(colors.glass), shadows.elevated]}>
          {/* Brand */}
          <Text style={[styles.title, { color: colors.primary }]}>Skåne Trails</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t('signIn.subtitle')}
          </Text>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* Google Sign-In Button */}
          <Pressable
            onPress={signIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [
              styles.googleButton,
              {
                backgroundColor: pressed ? colors.primaryDark : colors.primary,
              },
            ]}
          >
            <GoogleLogo size={20} />
            <Text style={[styles.googleText, { color: colors.text.inverse }]}>
              {t('signIn.continueWithGoogle')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerNote, { color: colors.text.muted }]}>
          {t('signIn.syncNote')}
        </Text>
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={[styles.signOutText, { color: colors.text.muted }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignItems: 'center',
    padding: spacing['2xl'],
    width: '100%',
    maxWidth: 380,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontSize.lg,
    marginBottom: spacing['2xl'],
  },
  errorBox: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  errorText: {
    textAlign: 'center',
    fontSize: fontSize.md,
  },
  googleButton: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  googleText: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.lg,
    marginLeft: spacing.md,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
  },
  signOutLink: {
    position: 'absolute',
    bottom: spacing['4xl'],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  signOutText: {
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: spacing['4xl'],
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  footerNote: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
