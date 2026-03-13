import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { foragingColor } from '@/lib/foraging-colors';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { cssShadow, glassSheet } from '@/lib/theme/styles';
import type { ForagingType } from '@/lib/types';
import { Button } from './Button';
import { Chip } from './Chip';
import { FormField } from './FormField';
import { TabIcon } from './TabIcon';

const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

interface AddSpotFormProps {
  types: ForagingType[];
  initialLat?: number;
  initialLng?: number;
  onSubmit: (data: {
    type: string;
    lat: number;
    lng: number;
    notes: string;
    month: string;
  }) => void;
  onCancel: () => void;
  onUseCurrentLocation: () => void;
  isSubmitting?: boolean;
}

export function AddSpotForm({
  types,
  initialLat,
  initialLng,
  onSubmit,
  onCancel,
  onUseCurrentLocation,
  isSubmitting = false,
}: AddSpotFormProps) {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState('');
  const [lat, setLat] = useState(initialLat?.toString() ?? '');
  const [lng, setLng] = useState(initialLng?.toString() ?? '');
  const [notes, setNotes] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Sync when coordinates are set externally (map click or geolocation)
  useEffect(() => {
    if (initialLat !== undefined) setLat(initialLat.toString());
  }, [initialLat]);
  useEffect(() => {
    if (initialLng !== undefined) setLng(initialLng.toString());
  }, [initialLng]);

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const coordinatesAreValid =
    !Number.isNaN(parsedLat) &&
    !Number.isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  const canSubmit =
    selectedType !== '' && selectedMonth !== '' && coordinatesAreValid && !isSubmitting;

  const handleSubmit = () => {
    if (!coordinatesAreValid) return;
    onSubmit({ type: selectedType, lat: parsedLat, lng: parsedLng, notes, month: selectedMonth });
  };

  return (
    <View
      style={[
        styles.card,
        glassSheet(colors.glass),
        Platform.OS === 'web' &&
          ({
            boxShadow: cssShadow(shadows, 'elevated'),
          } as any),
      ]}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('addSpot.title')}</Text>
          <Pressable
            onPress={onCancel}
            style={styles.closeButton}
            accessibilityLabel={t('common.cancel')}
          >
            <TabIcon name="close" color={colors.text.muted} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Type selector */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>{t('addSpot.type')} *</Text>
        <View style={styles.chipRow}>
          {types.map((typeItem) => {
            const isSelected = selectedType === typeItem.name;
            const dotColor = foragingColor(typeItem.color);
            return (
              <Pressable
                key={typeItem.name}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: isSelected ? colors.chip.activeBg : colors.chip.bg,
                    borderColor: isSelected ? colors.chip.activeBg : colors.glass.borderSubtle,
                  },
                  isSelected && styles.typeChipSelected,
                ]}
                onPress={() => setSelectedType(typeItem.name)}
              >
                <View style={[styles.typeDot, { backgroundColor: dotColor }]} />
                <Text
                  style={[
                    styles.typeChipText,
                    {
                      color: isSelected ? colors.chip.activeText : colors.chip.text,
                      fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                    },
                  ]}
                >
                  {typeItem.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Month selector */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>{t('addSpot.month')} *</Text>
        <View style={styles.chipRow}>
          {MONTH_KEYS.map((key) => {
            const label = t(`months.${key}`);
            return (
              <Chip
                key={key}
                label={label}
                selected={selectedMonth === key}
                onPress={() => setSelectedMonth(key)}
              />
            );
          })}
        </View>

        {/* Location */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>
          {t('addSpot.location')} *
        </Text>
        <Button
          title={t('addSpot.useCurrentLocation')}
          onPress={onUseCurrentLocation}
          variant="secondary"
        />
        <Text style={[styles.orText, { color: colors.text.muted }]}>{t('addSpot.orTapMap')}</Text>
        <View style={styles.coordRow}>
          <View style={styles.coordField}>
            <FormField
              label={t('addSpot.latitude')}
              value={lat}
              onChangeText={setLat}
              placeholder="55.95"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.coordField}>
            <FormField
              label={t('addSpot.longitude')}
              value={lng}
              onChangeText={setLng}
              placeholder="13.40"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Notes */}
        <FormField
          label={t('addSpot.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('addSpot.notesPlaceholder')}
          multiline
          numberOfLines={3}
        />

        {/* Actions */}
        <View style={styles.actions}>
          <Button title={t('common.cancel')} onPress={onCancel} variant="secondary" />
          <Button
            title={isSubmitting ? t('common.saving') : t('addSpot.addSpot')}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxWidth: 520,
    maxHeight: '85%',
    width: '100%',
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
    marginBottom: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  typeChipSelected: {
    shadowColor: 'rgba(0,40,20,0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeChipText: {
    fontSize: fontSize.sm,
  },
  orText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  coordRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordField: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
