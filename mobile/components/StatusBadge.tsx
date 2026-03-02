/**
 * Trail status badge (explored / to-explore).
 */

import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

interface StatusBadgeProps {
  status: 'Explored!' | 'To Explore' | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { colors } = useTheme();
  const isExplored = status === 'Explored!';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isExplored ? colors.status.exploredBg : colors.status.toExploreBg,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: isExplored ? colors.status.exploredText : colors.status.toExploreText,
          },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg - 4,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
