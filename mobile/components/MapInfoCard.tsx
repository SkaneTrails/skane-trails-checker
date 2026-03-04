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

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadows.card]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
          <Text style={[styles.closeText, { color: colors.text.muted }]}>✕</Text>
        </Pressable>
      </View>

      {children}

      {action && (
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={action.onPress}
        >
          <Text style={[styles.actionButtonText, { color: colors.text.inverse }]}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.lg - 2,
    maxWidth: 340,
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
  closeText: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
