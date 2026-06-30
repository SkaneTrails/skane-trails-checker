import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, spacing } from '@/lib/theme';

export function OfflineBanner(): ReactNode {
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {t('common.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: '#F59E0B',
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
