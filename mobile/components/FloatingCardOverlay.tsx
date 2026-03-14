/**
 * Floating card overlay for map selections.
 *
 * Centers a card over the map with a transparent backdrop.
 * No slide animation — appears instantly when open.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '@/lib/theme';

interface FloatingCardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const FloatingCardOverlay = ({ isOpen, onClose, children }: FloatingCardOverlayProps) => {
  if (!isOpen) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close card" />
      <View style={styles.container} pointerEvents="box-none">
        {children}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
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
