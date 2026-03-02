/**
 * Consistent screen wrapper with background color.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/lib/theme';

interface ScreenLayoutProps {
  children: ReactNode;
}

export function ScreenLayout({ children }: ScreenLayoutProps) {
  const { colors } = useTheme();

  return <View style={[styles.container, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
