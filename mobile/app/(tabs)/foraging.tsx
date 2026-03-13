import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, EmptyState, MapInfoCard, ScreenLayout } from '@/components';
import { AddSpotForm } from '@/components/AddSpotForm';
import { ForagingMap } from '@/components/ForagingMap';
import { useCreateForagingSpot, useDeleteForagingSpot, useForagingSpots, useForagingTypes, useUpdateForagingSpot } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingSpotCreate } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ForagingScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const isWeb = Platform.OS === 'web';
  const { data: spots, isFetching, error } = useForagingSpots(selectedMonth, { enabled: isWeb });
  const { data: types } = useForagingTypes({ enabled: isWeb });
  const createSpot = useCreateForagingSpot();
  const updateSpot = useUpdateForagingSpot();
  const deleteSpot = useDeleteForagingSpot();

  const [selectedSpot, setSelectedSpot] = useState<ForagingSpot | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formLat, setFormLat] = useState<number | undefined>();
  const [formLng, setFormLng] = useState<number | undefined>();
  const [editingSpot, setEditingSpot] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editMonth, setEditMonth] = useState('');

  const startEditing = useCallback(() => {
    if (!selectedSpot) return;
    setEditNotes(selectedSpot.notes);
    setEditMonth(selectedSpot.month);
    setEditingSpot(true);
  }, [selectedSpot]);

  const handleSaveEdit = useCallback(() => {
    if (!selectedSpot) return;
    const updates: Record<string, string> = {};
    if (editNotes !== selectedSpot.notes) updates.notes = editNotes;
    if (editMonth !== selectedSpot.month) updates.month = editMonth;
    if (Object.keys(updates).length === 0) {
      setEditingSpot(false);
      return;
    }
    updateSpot.mutate({ id: selectedSpot.id, data: updates }, {
      onSuccess: () => {
        setEditingSpot(false);
        setSelectedSpot(null);
      },
    });
  }, [selectedSpot, editNotes, editMonth, updateSpot]);

  const handleDeleteSpot = useCallback(() => {
    if (!selectedSpot) return;
    deleteSpot.mutate(selectedSpot.id, {
      onSuccess: () => setSelectedSpot(null),
    });
  }, [selectedSpot, deleteSpot]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (showAddForm) {
        setFormLat(lat);
        setFormLng(lng);
      }
    },
    [showAddForm],
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setFormLng(parseFloat(pos.coords.longitude.toFixed(6)));
      },
      () => {
        // Geolocation denied or unavailable — user can enter manually
      },
      { enableHighAccuracy: true },
    );
  }, []);

  const handleAddSpot = useCallback(
    (data: ForagingSpotCreate) => {
      createSpot.mutate(data, {
        onSuccess: () => {
          setShowAddForm(false);
          setFormLat(undefined);
          setFormLng(undefined);
        },
      });
    },
    [createSpot],
  );

  const openAddForm = () => {
    setSelectedSpot(null);
    setFormLat(undefined);
    setFormLng(undefined);
    setShowAddForm(true);
  };

  if (Platform.OS !== 'web') {
    return (
      <ScreenLayout>
        <EmptyState
          emoji="🗺️"
          title={t('foraging.mapWebOnly')}
          subtitle={t('foraging.mapRequiresBrowser')}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {/* Month filter bar */}
      <View
        style={[
          styles.monthBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
        ]}
      >
        <Chip label={t('common.all')} selected={!selectedMonth} onPress={() => setSelectedMonth(undefined)} />
        {MONTHS.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={selectedMonth === m}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          />
        ))}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <ForagingMap
          spots={spots ?? []}
          types={types ?? []}
          onSpotSelect={(spot) => {
            setShowAddForm(false);
            setSelectedSpot(spot);
          }}
          onMapClick={handleMapClick}
        />

        {/* Spot info / edit card */}
        {selectedSpot && !showAddForm && (
          <View style={styles.cardOverlay} pointerEvents="box-none">
            {editingSpot ? (
              <MapInfoCard title={selectedSpot.type} onClose={() => { setEditingSpot(false); setSelectedSpot(null); }}>
                <View style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.text.secondary }]}>
                    {t('foraging.monthLabel')}
                  </Text>
                  <View style={styles.monthChips}>
                    {MONTHS.map((m) => (
                      <Chip key={m} label={m} selected={editMonth === m} onPress={() => setEditMonth(m)} />
                    ))}
                  </View>
                </View>
                <View style={styles.editField}>
                  <Text style={[styles.editLabel, { color: colors.text.secondary }]}>
                    {t('foraging.notesLabel')}
                  </Text>
                  <TextInput
                    style={[styles.editInput, { borderColor: colors.border, color: colors.text.primary, backgroundColor: colors.surface }]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder={t('addSpot.notesPlaceholder')}
                    placeholderTextColor={colors.text.muted}
                    multiline
                  />
                </View>
                <View style={styles.editButtons}>
                  <Pressable
                    style={[styles.editSecondary, { borderColor: colors.border }]}
                    onPress={() => setEditingSpot(false)}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: fontSize.sm }}>
                      {t('common.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.editPrimary, { backgroundColor: colors.status.exploredBg }]}
                    onPress={handleDeleteSpot}
                    disabled={deleteSpot.isPending}
                  >
                    <Text style={{ color: colors.status.exploredText, fontSize: fontSize.sm }}>
                      {t('common.delete')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.editPrimary, { backgroundColor: colors.primary }]}
                    onPress={handleSaveEdit}
                    disabled={updateSpot.isPending}
                  >
                    <Text style={{ color: colors.text.inverse, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                      {updateSpot.isPending ? t('common.saving') : t('common.save')}
                    </Text>
                  </Pressable>
                </View>
              </MapInfoCard>
            ) : (
              <MapInfoCard
                title={selectedSpot.type}
                onClose={() => setSelectedSpot(null)}
                action={{ label: t('foraging.editSpot'), onPress: startEditing }}
              >
                <Text style={[styles.spotMonth, { color: colors.text.secondary }]}>
                  📅 {selectedSpot.month}
                </Text>
                {selectedSpot.notes ? (
                  <Text style={[styles.spotNotes, { color: colors.text.primary }]}>
                    {selectedSpot.notes}
                  </Text>
                ) : null}
                <Text style={[styles.spotCoords, { color: colors.text.muted }]}>
                  📍 {selectedSpot.lat.toFixed(4)}, {selectedSpot.lng.toFixed(4)}
                </Text>
              </MapInfoCard>
            )}
          </View>
        )}

        {/* Add spot form */}
        {showAddForm && (
          <View style={styles.formOverlay} pointerEvents="box-none">
            <AddSpotForm
              types={types ?? []}
              initialLat={formLat}
              initialLng={formLng}
              onSubmit={handleAddSpot}
              onCancel={() => {
                setShowAddForm(false);
                setFormLat(undefined);
                setFormLng(undefined);
              }}
              onUseCurrentLocation={handleUseCurrentLocation}
              isSubmitting={createSpot.isPending}
            />
          </View>
        )}

        {/* Add button */}
        {!showAddForm && (
          <Pressable
            style={[styles.fab, { backgroundColor: colors.primary }, shadows.card]}
            onPress={openAddForm}
            accessibilityLabel={t('foraging.addSpotAccessibility')}
          >
            <Text style={[styles.fabText, { color: colors.text.inverse }]}>{t('foraging.addSpot')}</Text>
          </Pressable>
        )}

        {/* Loading spinner */}
        {isFetching && (
          <View style={[styles.spinner, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator size="small" color={colors.overlayText} />
          </View>
        )}

        {/* Error state */}
        {error && !spots?.length && (
          <View style={styles.errorOverlay}>
            <Text
              style={[
                styles.errorText,
                { backgroundColor: colors.overlay, color: colors.overlayText },
              ]}
            >
              {t('foraging.couldNotLoad')}
            </Text>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm - 2,
    borderBottomWidth: 1,
  },
  mapContainer: {
    flex: 1,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  formOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  spotMonth: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  spotNotes: {
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },
  spotCoords: {
    fontSize: fontSize.xs,
  },
  editField: {
    marginBottom: spacing.sm,
  },
  editLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  monthChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  editPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    zIndex: 999,
  },
  fabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  spinner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    borderRadius: borderRadius.pill,
    padding: spacing.sm,
    pointerEvents: 'none',
  },
  errorOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  errorText: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    fontSize: fontSize.md,
    overflow: 'hidden',
  },
});
