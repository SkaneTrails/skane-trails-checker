/**
 * Trail-specific content for the map info card.
 * Renders status, distance, difficulty, source, and elevation
 * inside a MapInfoCard shell.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { fontSize, spacing, useTheme } from '@/lib/theme';
import type { Trail } from '@/lib/types';
import { MapInfoCard } from './MapInfoCard';
import { StatusBadge } from './StatusBadge';

interface TrailCardProps {
  trail: Trail;
  onViewDetails: (trail: Trail) => void;
  onClose: () => void;
}

export const TrailCard = ({ trail, onViewDetails, onClose }: TrailCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <MapInfoCard
      title={trail.name}
      onClose={onClose}
      action={{ label: t('trailCard.viewDetails'), onPress: () => onViewDetails(trail) }}
    >
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
    </MapInfoCard>
  );
};

const styles = StyleSheet.create({
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
});
