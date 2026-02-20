import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { TrailMap } from '@/components/TrailMap';
import { useTrails } from '@/lib/hooks';
import { type ColorTokens, type SpacingTokens, useTheme } from '@/lib/theme';

export default function MapScreen() {
  const { colors, spacing } = useTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const { data: trails, isLoading, error } = useTrails();

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text>Map is currently available on web only.</Text>
        <Text>Use the Trails tab to see your trails.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TrailMap trails={trails ?? []} />
      {isLoading && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Loading trails...</Text>
        </View>
      )}
      {error && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Could not connect to API — showing empty map</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ColorTokens, spacing: SpacingTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
    },
    overlay: {
      position: 'absolute',
      top: spacing['md-lg'],
      left: 0,
      right: 0,
      alignItems: 'center',
      pointerEvents: 'none',
    },
    overlayText: {
      backgroundColor: colors.overlay,
      color: colors.text.inverse,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: spacing['2xl'],
      fontSize: 14,
      overflow: 'hidden',
    },
  });
