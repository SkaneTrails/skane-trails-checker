/**
 * Compact trail info card for map overlay.
 * Shows trail name, status, distance, difficulty, source,
 * with a "View Details" link and a close button.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Trail } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface TrailCardProps {
  trail: Trail;
  onViewDetails: (trail: Trail) => void;
  onClose: () => void;
}

export const TrailCard = ({ trail, onViewDetails, onClose }: TrailCardProps) => {
  const { colors, shadows } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadows.card]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
          {trail.name}
        </Text>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
          <Text style={[styles.closeText, { color: colors.text.muted }]}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.badgeRow}>
        <StatusBadge status={trail.status} />
      </View>

      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: colors.text.secondary }]}>
          📏 {trail.length_km.toFixed(1)} km
        </Text>
        {trail.difficulty && (
          <Text style={[styles.metaText, { color: colors.text.secondary }]}>
            ⛰️ {trail.difficulty}
          </Text>
        )}
        <Text style={[styles.metaText, { color: colors.text.secondary }]}>
          📂 {trail.source.replace(/_/g, ' ')}
        </Text>
      </View>

      {(trail.elevation_gain != null || trail.elevation_loss != null) && (
        <View style={styles.meta}>
          {trail.elevation_gain != null && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              ↗ {Math.round(trail.elevation_gain)} m
            </Text>
          )}
          {trail.elevation_loss != null && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              ↘ {Math.round(trail.elevation_loss)} m
            </Text>
          )}
        </View>
      )}

      <Pressable
        style={[styles.detailsButton, { backgroundColor: colors.primary }]}
        onPress={() => onViewDetails(trail)}
      >
        <Text style={[styles.detailsButtonText, { color: colors.text.inverse }]}>
          View Details
        </Text>
      </Pressable>
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
    marginBottom: spacing.xs,
  },
  name: {
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
  badgeRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
  },
  detailsButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  detailsButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
