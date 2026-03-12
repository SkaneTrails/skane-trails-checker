import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Chip } from './Chip';
import { FormField } from './FormField';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingType } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface AddSpotFormProps {
  types: ForagingType[];
  initialLat?: number;
  initialLng?: number;
  onSubmit: (data: { type: string; lat: number; lng: number; notes: string; month: string }) => void;
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

  const canSubmit =
    selectedType !== '' &&
    selectedMonth !== '' &&
    lat !== '' &&
    lng !== '' &&
    !isSubmitting;

  const handleSubmit = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;
    onSubmit({ type: selectedType, lat: parsedLat, lng: parsedLng, notes, month: selectedMonth });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadows.card]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Add Foraging Spot</Text>
          <Pressable onPress={onCancel} style={styles.closeButton} accessibilityLabel="Close">
            <Text style={[styles.closeText, { color: colors.text.muted }]}>✕</Text>
          </Pressable>
        </View>

        {/* Type selector */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Type *</Text>
        <View style={styles.chipRow}>
          {types.map((t) => (
            <Chip
              key={t.name}
              label={`${t.icon} ${t.name}`}
              selected={selectedType === t.name}
              onPress={() => setSelectedType(t.name)}
            />
          ))}
        </View>

        {/* Month selector */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Month *</Text>
        <View style={styles.chipRow}>
          {MONTHS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={selectedMonth === m}
              onPress={() => setSelectedMonth(m)}
            />
          ))}
        </View>

        {/* Location */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Location *</Text>
        <Button title="📍 Use Current Location" onPress={onUseCurrentLocation} variant="secondary" />
        <Text style={[styles.orText, { color: colors.text.muted }]}>or tap on the map, or enter manually:</Text>
        <View style={styles.coordRow}>
          <View style={styles.coordField}>
            <FormField
              label="Latitude"
              value={lat}
              onChangeText={setLat}
              placeholder="55.95"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.coordField}>
            <FormField
              label="Longitude"
              value={lng}
              onChangeText={setLng}
              placeholder="13.40"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Notes */}
        <FormField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any observations..."
          multiline
          numberOfLines={3}
        />

        {/* Actions */}
        <View style={styles.actions}>
          <Button title="Cancel" onPress={onCancel} variant="secondary" />
          <Button
            title={isSubmitting ? 'Saving...' : 'Add Spot'}
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
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    maxWidth: 400,
    maxHeight: '80%',
    width: '100%',
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
  closeText: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg,
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
