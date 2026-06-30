/**
 * Full-height drawer overlay that slides in from the right.
 *
 * Used by hamburger menu items (Trails, Foraging, Places, Admin) to show
 * list views over the map. Identical look on web and native.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';
import { TabIcon } from './TabIcon';

interface DrawerOverlayProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const DrawerOverlay = ({ isOpen, title, children, onClose }: DrawerOverlayProps) => {
  const { colors, shadows } = useTheme();

  if (!isOpen) return null;

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close drawer" />

      {/* Drawer panel */}
      <View style={[styles.panel, glassCard(colors.glass), shadows.elevated]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.closeButton, { backgroundColor: colors.glass.background }]}
          >
            <TabIcon name="x" color={colors.text.secondary} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    width: '85%',
    maxWidth: 400,
    height: '100%',
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  closeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
