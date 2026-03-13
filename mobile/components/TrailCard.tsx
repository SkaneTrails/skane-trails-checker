/**
 * Trail-specific content for the map info card.
 * Renders status, distance, difficulty, source, and elevation
 * inside a MapInfoCard shell.
 *
 * Supports inline editing of status, difficulty, activity date, and
 * activity type — triggered by the "Edit" button. Changes are saved
 * directly from the card overlay.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Trail, TrailUpdate } from '@/lib/types';
import { MapInfoCard } from './MapInfoCard';
import { StatusBadge } from './StatusBadge';

interface TrailCardProps {
  trail: Trail;
  onViewDetails: (trail: Trail) => void;
  onClose: () => void;
  onUpdate?: (trailId: string, data: TrailUpdate, onSuccess: () => void) => void;
  isUpdating?: boolean;
}

export const TrailCard = ({ trail, onViewDetails, onClose, onUpdate, isUpdating }: TrailCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(trail.status);
  const [difficulty, setDifficulty] = useState(trail.difficulty);
  const [activityDate, setActivityDate] = useState(trail.activity_date ?? '');
  const [activityType, setActivityType] = useState(trail.activity_type ?? '');

  const handleSave = () => {
    if (!onUpdate) return;
    const updates: TrailUpdate = {};
    if (status !== trail.status) updates.status = status;
    if (difficulty !== trail.difficulty) updates.difficulty = difficulty;
    if (activityDate !== (trail.activity_date ?? '')) updates.activity_date = activityDate || undefined;
    if (activityType !== (trail.activity_type ?? '')) updates.activity_type = activityType || undefined;
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    onUpdate(trail.trail_id, updates, () => setEditing(false));
  };

  if (editing) {
    return (
      <MapInfoCard title={trail.name} onClose={onClose}>
        {/* Status toggle */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.statusLabel')}
          </Text>
          <View style={styles.statusToggle}>
            <Pressable
              style={[
                styles.toggleOption,
                {
                  backgroundColor: status === 'To Explore' ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setStatus('To Explore')}
            >
              <Text
                style={{
                  color: status === 'To Explore' ? colors.text.inverse : colors.text.primary,
                  fontSize: fontSize.sm,
                }}
              >
                {t('trails.toExplore')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleOption,
                {
                  backgroundColor: status === 'Explored!' ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setStatus('Explored!')}
            >
              <Text
                style={{
                  color: status === 'Explored!' ? colors.text.inverse : colors.text.primary,
                  fontSize: fontSize.sm,
                }}
              >
                {t('trails.explored')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.difficultyLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={difficulty}
            onChangeText={setDifficulty}
            placeholder={t('trail.difficultyLabel')}
            placeholderTextColor={colors.text.muted}
          />
        </View>

        {/* Activity date */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.activityLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={activityDate}
            onChangeText={setActivityDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
          />
        </View>

        {/* Activity type */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.typeLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={activityType}
            onChangeText={setActivityType}
            placeholder={t('trail.typeLabel')}
            placeholderTextColor={colors.text.muted}
          />
        </View>

        {/* Save / Cancel */}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => setEditing(false)}
          >
            <Text style={{ color: colors.text.primary, fontSize: fontSize.sm }}>
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isUpdating}
          >
            <Text style={{ color: colors.text.inverse, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
              {isUpdating ? t('common.saving') : t('common.save')}
            </Text>
          </Pressable>
        </View>
      </MapInfoCard>
    );
  }

  return (
    <MapInfoCard
      title={trail.name}
      onClose={onClose}
      action={{ label: t('trailCard.viewDetails'), onPress: () => onViewDetails(trail) }}
    >
      <View style={styles.badgeRow}>
        <StatusBadge status={trail.status} />
        {onUpdate && (
          <Pressable onPress={() => setEditing(true)} style={styles.editButton}>
            <Text style={[styles.editText, { color: colors.primary }]}>
              {t('trailCard.edit')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: colors.text.secondary }]}>
          {trail.length_km.toFixed(1)} km
        </Text>
        {trail.difficulty && (
          <Text style={[styles.metaText, { color: colors.text.secondary }]}>
            {trail.difficulty}
          </Text>
        )}
        <Text style={[styles.metaText, { color: colors.text.secondary }]}>
          {trail.source.replace(/_/g, ' ')}
        </Text>
      </View>

      {(trail.elevation_gain != null || trail.elevation_loss != null) && (
        <View style={styles.meta}>
          {trail.elevation_gain != null && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              +{Math.round(trail.elevation_gain)} m
            </Text>
          )}
          {trail.elevation_loss != null && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              -{Math.round(trail.elevation_loss)} m
            </Text>
          )}
        </View>
      )}

      {(trail.activity_date || trail.activity_type) && (
        <View style={styles.meta}>
          {trail.activity_date && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              📅 {trail.activity_date}
            </Text>
          )}
          {trail.activity_type && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              🏃 {trail.activity_type}
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
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  editButton: {
    marginLeft: 'auto',
  },
  editText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
  },
  fieldRow: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  statusToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
});
