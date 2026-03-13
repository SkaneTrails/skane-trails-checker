/**
 * CSS-animated bottom sheet for map overlays.
 *
 * Slides up from bottom with glass background and drag handle.
 * Web-only: uses CSS transitions for smooth animation.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { animation, borderRadius, sheet, spacing, useTheme } from '@/lib/theme';
import { glassSheet } from '@/lib/theme/styles';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const BottomSheet = ({ isOpen, onClose, children }: BottomSheetProps) => {
  const { colors, shadows } = useTheme();
  const glass = glassSheet(colors.glass);

  // Override borderRadius from glassSheet with explicit corner values
  const sheetGlass = { ...glass, borderRadius: undefined };

  return (
    <>
      {isOpen && (
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close sheet" />
      )}
      <View
        style={[
          sheetGlass,
          shadows.elevated,
          styles.sheet,
          {
            transform: [{ translateY: isOpen ? 0 : 600 }],
            opacity: isOpen ? 1 : 0,
            transition: `transform ${animation.duration.slow}ms ${animation.easing.spring}, opacity ${animation.duration.normal}ms ease`,
          } as Record<string, unknown>,
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.text.muted, opacity: 0.3 }]} />
        </View>
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
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    maxHeight: '70%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handle: {
    width: sheet.handleWidth,
    height: sheet.handleHeight,
    borderRadius: borderRadius.full,
  },
});
