/**
 * Generic map info card shell — positioned as a floating overlay.
 *
 * Provides title, close button, optional action button, and a
 * `children` slot for domain-specific content (trail info,
 * foraging spot form, etc.).
 */

import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  /** Optional control pinned in the header, left of the close button. */
  headerAccessory?: ReactNode;
  children: ReactNode;
}

/**
 * On web, give the scroll area a thin scrollbar that only appears when the
 * content actually overflows (`auto`), so a non-scrolling card doesn't show a
 * dead, empty scrollbar track. Ignored on native.
 */
const webScrollbarStyle =
  Platform.OS === 'web' ? ({ overflowY: 'auto', scrollbarWidth: 'thin' } as const) : null;

/** Approx. height (px) of the header row + card padding + action button. */
const HEADER_ALLOWANCE = 140;

/**
 * Keeps the card at its original compact size: the scroll body never grows
 * past this, so tall content (e.g. a full-size photo) scrolls instead of
 * stretching the whole card.
 */
const MAX_BODY_HEIGHT = 420;

export const MapInfoCard = ({ title, onClose, action, headerAccessory, children }: MapInfoCardProps) => {
  const { colors, shadows } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // Bound the scroll area so it scrolls rather than expanding the card. Capped
  // by MAX_BODY_HEIGHT to keep the card compact, and by the window on small
  // screens. (RNW web won't scroll an auto-height flex child reliably.)
  const scrollMaxHeight = Math.min(windowHeight * 0.8 - HEADER_ALLOWANCE, MAX_BODY_HEIGHT);

  return (
    <View
      style={[
        glassCard(colors.glass),
        shadows.elevated,
        styles.card,
        { maxHeight: windowHeight * 0.8 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {headerAccessory}
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
          <TabIcon name="close" color={colors.text.muted} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        style={[styles.scroll, { maxHeight: scrollMaxHeight }, webScrollbarStyle as any]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>

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
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxWidth: 360,
    width: '100%',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
