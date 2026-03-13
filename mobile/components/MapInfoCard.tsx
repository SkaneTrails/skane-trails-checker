/**
 * Generic map info card shell — positioned as a map overlay.
 *
 * Provides title, close button, optional action button, and a
 * `children` slot for domain-specific content (trail info,
 * foraging spot form, etc.).
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';
import { TabIcon } from './TabIcon';

interface MapInfoCardAction {
  label: string;
  onPress: () => void;
}

interface MapInfoCardProps {
  title: string;
  onClose: () => void;
  action?: MapInfoCardAction;
  children: ReactNode;
}

export const MapInfoCard = ({ title, onClose, action, children }: MapInfoCardProps) => {
  const { colors, shadows } = useTheme();

  // Override borderRadius from glassCard with explicit corner values
  const cardGlass = { ...glassCard(colors.glass), borderRadius: undefined };

  return (
    <View
      style={[
        cardGlass,
        shadows.elevated,
        styles.card,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
          <TabIcon name="close" color={colors.text.muted} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      {children}

      {action && (
        <Pressable
          style={[styles.actionButton, { borderWidth: 1, borderColor: colors.primary }]}
          onPress={action.onPress}
        >
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    maxWidth: 360,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
