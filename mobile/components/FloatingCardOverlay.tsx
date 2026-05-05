/**
 * Floating card overlay for map selections.
 *
 * Renders a card over the map without blocking map interactions.
 * The card itself captures events; the surrounding area passes
 * events through to the map via pointerEvents="box-none".
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/lib/theme';

interface FloatingCardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const FloatingCardOverlay = ({ isOpen, children }: FloatingCardOverlayProps) => {
  if (!isOpen) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {children}
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
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
