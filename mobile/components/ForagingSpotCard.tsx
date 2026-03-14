/**
 * Foraging spot floating card — view and inline edit mode.
 *
 * All fields (type, month, notes) are editable from the card.
 * Uses theme tokens for all visual properties.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingSpotUpdate } from '@/lib/types';
import { MapInfoCard } from './MapInfoCard';
import { TabIcon } from './TabIcon';

interface ForagingSpotCardProps {
  spot: ForagingSpot;
  onClose: () => void;
  onUpdate?: (id: string, data: ForagingSpotUpdate, onSuccess: () => void) => void;
  isUpdating?: boolean;
}

export const ForagingSpotCard = ({ spot, onClose, onUpdate, isUpdating }: ForagingSpotCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(spot.type);
  const [editMonth, setEditMonth] = useState(spot.month);
  const [editNotes, setEditNotes] = useState(spot.notes);

  const handleSave = () => {
    if (!onUpdate) return;
    const updates: ForagingSpotUpdate = {};
    if (editType !== spot.type) updates.type = editType;
    if (editMonth !== spot.month) updates.month = editMonth;
    if (editNotes !== spot.notes) updates.notes = editNotes;
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    onUpdate(spot.id, updates, () => setEditing(false));
  };

  if (editing) {
    return (
      <MapInfoCard title={t('foraging.editSpot')} onClose={onClose}>
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('foraging.typeLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={editType}
            onChangeText={setEditType}
            placeholderTextColor={colors.text.muted}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('foraging.monthLabel')}
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={editMonth}
            onChangeText={setEditMonth}
            placeholder="Jan, Feb, ..."
            placeholderTextColor={colors.text.muted}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
            {t('foraging.notesLabel')}
          </Text>
          <TextInput
            style={[styles.input, styles.multilineInput, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
            value={editNotes}
            onChangeText={setEditNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.text.muted}
          />
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
      </MapInfoCard>
    );
  }

  return (
    <MapInfoCard title={spot.type} onClose={onClose}>
      <Text style={[styles.metaText, { color: colors.text.secondary }]}>
        {spot.month}
      </Text>
      {spot.notes ? (
        <Text style={[styles.notesText, { color: colors.text.primary }]}>
          {spot.notes}
        </Text>
      ) : null}
      <Text style={[styles.coordText, { color: colors.text.muted }]}>
        {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>

      {/* Edit icon */}
      {onUpdate && (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.editIcon, { borderColor: colors.border }]}
          accessibilityLabel={t('foraging.editSpot')}
        >
          <TabIcon name="edit" color={colors.primary} size={16} strokeWidth={2} />
        </Pressable>
      )}
    </MapInfoCard>
  );
};

const styles = StyleSheet.create({
  metaText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  coordText: {
    fontSize: fontSize.xs,
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
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 60,
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
