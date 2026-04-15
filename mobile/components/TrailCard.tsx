/**
 * Trail floating card — display mode shows name, date, distance,
 * duration, inclination, elevation profile. Edit mode allows
 * changing name and activity date only (GPX provides the rest).
 */

import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Trail, TrailUpdate } from '@/lib/types';
import { ColorPicker } from './ColorPicker';
import { ElevationProfile } from './ElevationProfile';
import { MapInfoCard } from './MapInfoCard';
import { TabIcon } from './TabIcon';

interface TrailCardProps {
  trail: Trail;
  onClose: () => void;
  onUpdate?: (trailId: string, data: TrailUpdate, onSuccess: () => void) => void;
  isUpdating?: boolean;
  onDelete?: (trailId: string, onSuccess: () => void) => void;
  isDeleting?: boolean;
  initialEditing?: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const TrailCard = ({ trail, onClose, onUpdate, isUpdating, onDelete, isDeleting, initialEditing }: TrailCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(initialEditing ?? false);
  const [editName, setEditName] = useState(trail.name);
  const [editDate, setEditDate] = useState(trail.activity_date ?? '');
  const [editColor, setEditColor] = useState<string | null>(trail.line_color ?? null);
  const [editPublic, setEditPublic] = useState(trail.is_public ?? false);

  // Reset form state when trail changes or initialEditing becomes true
  useEffect(() => {
    setEditName(trail.name);
    setEditDate(trail.activity_date ?? '');
    setEditColor(trail.line_color ?? null);
    setEditPublic(trail.is_public ?? false);
    if (initialEditing) {
      setEditing(true);
    }
  }, [trail.trail_id, initialEditing]);

  const handleSave = () => {
    if (!onUpdate) return;
    const updates: TrailUpdate = {};
    if (editName !== trail.name) updates.name = editName;
    if (editDate !== (trail.activity_date ?? '')) updates.activity_date = editDate || undefined;
    if (editColor !== (trail.line_color ?? null)) updates.line_color = editColor;
    if (editPublic !== (trail.is_public ?? false)) updates.is_public = editPublic;
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    onUpdate(trail.trail_id, updates, () => setEditing(false));
  };

  if (editing) {
    return (
      <MapInfoCard title={t('trailCard.edit')} onClose={onClose}>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.nameLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={editName}
            onChangeText={setEditName}
            placeholderTextColor={colors.text.muted}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trail.activityLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={editDate}
            onChangeText={setEditDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trailCard.lineColor')}
          </Text>
          <ColorPicker selected={editColor} onSelect={setEditColor} />
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('trailCard.visibility')}
          </Text>
          <View style={styles.chipRow}>
            <Chip
              label={t('trailCard.privateTrail')}
              selected={!editPublic}
              onPress={() => setEditPublic(false)}
            />
            <Chip
              label={t('trailCard.publicTrail')}
              selected={editPublic}
              onPress={() => setEditPublic(true)}
            />
          </View>
        </View>

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

        {onDelete && (
          <Pressable
            style={[styles.deleteButton, { borderColor: colors.error }]}
            onPress={() => {
              const message = t('trail.deleteConfirm', { name: trail.name });
              const doDelete = () => onDelete(trail.trail_id, onClose);
              if (Platform.OS === 'web') {
                if (window.confirm(message)) {
                  doDelete();
                }
              } else {
                Alert.alert(
                  t('trail.deleteTrail'),
                  message,
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('trail.deleteTrail'), style: 'destructive', onPress: doDelete },
                  ],
                );
              }
            }}
            disabled={isDeleting}
          >
            <Text style={{ color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
              {isDeleting ? t('common.deleting') : t('trail.deleteTrail')}
            </Text>
          </Pressable>
        )}
      </MapInfoCard>
    );
  }

  return (
    <MapInfoCard title={trail.name} onClose={onClose}>
      {/* Date */}
      {trail.activity_date && (
        <Text style={[styles.dateText, { color: colors.text.muted }]}>
          {new Date(trail.activity_date).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {/* Stats row: distance, duration */}
      <View style={styles.statsRow}>
        <Text style={[styles.statText, { color: colors.text.secondary }]}>
          {trail.length_km.toFixed(1)} km
        </Text>
        {trail.duration_minutes != null && (
          <>
            <Text style={[styles.statDot, { color: colors.text.muted }]}>·</Text>
            <Text style={[styles.statText, { color: colors.text.secondary }]}>
              {formatDuration(trail.duration_minutes)}
            </Text>
          </>
        )}
      </View>

      {/* Elevation gain / loss */}
      {(trail.elevation_gain != null || trail.elevation_loss != null) && (
        <View style={styles.statsRow}>
          {trail.elevation_gain != null && (
            <Text style={[styles.statText, { color: colors.text.secondary }]}>
              ↑ {Math.round(trail.elevation_gain)} m
            </Text>
          )}
          {trail.elevation_loss != null && (
            <>
              <Text style={[styles.statDot, { color: colors.text.muted }]}>·</Text>
              <Text style={[styles.statText, { color: colors.text.secondary }]}>
                ↓ {Math.round(trail.elevation_loss)} m
              </Text>
            </>
          )}
        </View>
      )}

      {/* Elevation profile */}
      <View style={styles.profileContainer}>
        <ElevationProfile coordinates={trail.coordinates_map} />
      </View>

      {/* Edit icon */}
      {onUpdate && (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.editIcon, { borderColor: colors.border }]}
          accessibilityLabel={t('trailCard.edit')}
        >
          <TabIcon name="edit" color={colors.primary} size={16} strokeWidth={2} />
        </Pressable>
      )}
    </MapInfoCard>
  );
};

const styles = StyleSheet.create({
  dateText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statText: {
    fontSize: fontSize.sm,
  },
  statDot: {
    fontSize: fontSize.sm,
  },
  profileContainer: {
    marginTop: spacing.sm,
    overflow: 'hidden',
    borderRadius: borderRadius.sm,
  },
  editIcon: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg + spacing.xl + spacing.xs,
    padding: spacing.xs,
  },
  fieldRow: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  deleteButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
  },
});
