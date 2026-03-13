/**
 * Consistent screen wrapper — glass card that slides down from the top.
 *
 * On web (tab screens): translucent glass card with rounded bottom corners,
 * a built-in title header, slide-down animation, and a gap above the
 * floating tab bar to reveal the background map. Mirrors the BottomSheet
 * aesthetic but anchored to the top edge.
 *
 * On native: falls back to a solid background.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { borderRadius, fontSize, fontWeight, sheet, spacing, useTheme } from '@/lib/theme';
import { cssShadow, glassSurface } from '@/lib/theme/styles';
import { animation } from '@/lib/theme/layout';

interface ScreenLayoutProps {
  children: ReactNode;
  /** Title shown in the card header. Omit for no header. */
  title?: string;
  /** Set false for Stack screens (upload, trail detail) that don't need the tab gap */
  tabGap?: boolean;
}

export function ScreenLayout({ children, title, tabGap = true }: ScreenLayoutProps) {
  const { colors, shadows } = useTheme();
  const router = useRouter();

  // Track focus: hide card when tab loses focus so translucent layers don't stack
  const [focused, setFocused] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setAnimKey((k) => k + 1);
      return () => setFocused(false);
    }, []),
  );

  if (Platform.OS === 'web') {
    if (!focused && tabGap) return null;
    return (
      <View style={styles.outer}>
        <View
          key={animKey}
          style={[
            styles.card,
            tabGap && styles.cardTabGap,
            glassSurface(colors.glass),
            {
              borderBottomLeftRadius: tabGap ? borderRadius.xl : 0,
              borderBottomRightRadius: tabGap ? borderRadius.xl : 0,
              boxShadow: tabGap ? cssShadow(shadows, 'card') : 'none',
              animation: `slideDown ${animation.duration.entrance}ms ${animation.easing.decelerate} both`,
            } as any,
          ]}
        >
          {title && (
            <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          )}
          {children}
          {/* Drag handle at bottom of card */}
          {tabGap && (
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: colors.text.muted, opacity: 0.3 }]}
              />
            </View>
          )}
        </View>
        {/* Tap gap area to go back to map */}
        {tabGap && (
          <Pressable
            style={styles.gapTouchable}
            onPress={() => router.push('/(tabs)/' as never)}
            accessibilityLabel="Back to map"
          />
        )}
      </View>
    );
  }

  return <View style={[styles.container, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  cardTabGap: {
    marginBottom: 100,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  handle: {
    width: sheet.handleWidth,
    height: sheet.handleHeight,
    borderRadius: borderRadius.full,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  gapTouchable: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  container: {
    flex: 1,
  },
});
