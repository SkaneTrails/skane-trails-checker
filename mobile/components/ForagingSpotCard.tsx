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
import { Chip } from './Chip';
import { MapInfoCard } from './MapInfoCard';
import { TabIcon } from './TabIcon';

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

type MonthKey = (typeof MONTH_KEYS)[number];

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
  const [editMonths, setEditMonths] = useState<string[]>(
    spot.months.map((m) => m.toLowerCase()),
  );
  const [editNotes, setEditNotes] = useState(spot.notes);

  const handleToggleMonth = (key: string) => {
    setEditMonths((prev) => {
      if (prev.includes(key)) {
        // Prevent deselecting the last remaining month (backend requires ≥1).
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== key);
      }
      return [...prev, key];
    });
  };

  const handleSave = () => {
    if (!onUpdate) return;
    const updates: ForagingSpotUpdate = {};
    if (editType !== spot.type) updates.type = editType;
    // Sort into calendar order and convert lowercase keys back to title-case for
    // the API (jan→Jan) so ordering differences don't trigger spurious updates.
    const newMonths = [...editMonths]
      .sort((a, b) => MONTH_KEYS.indexOf(a as MonthKey) - MONTH_KEYS.indexOf(b as MonthKey))
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
    if (JSON.stringify(newMonths) !== JSON.stringify(spot.months)) updates.months = newMonths;
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
            {t('foraging.monthsLabel')}
          </Text>
          <View style={styles.chipRow}>
            {MONTH_KEYS.map((key) => {
              const label = t(`months.${key}`);
              return (
                <Chip
                  key={key}
                  label={label}
                  selected={editMonths.includes(key)}
                  onPress={() => handleToggleMonth(key)}
                />
              );
            })}
          </View>
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
        {spot.months.join(', ')}
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
