import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip, EmptyState, MapInfoCard, ScreenLayout } from '@/components';
import { AddSpotForm } from '@/components/AddSpotForm';
import { ForagingMap } from '@/components/ForagingMap';
import { useCreateForagingSpot, useForagingSpots, useForagingTypes } from '@/lib/hooks';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot, ForagingSpotCreate } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ForagingScreen() {
  const { colors, shadows } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isFetching, error } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();
  const createSpot = useCreateForagingSpot();

  const [selectedSpot, setSelectedSpot] = useState<ForagingSpot | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formLat, setFormLat] = useState<number | undefined>();
  const [formLng, setFormLng] = useState<number | undefined>();

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
          title="Map is currently available on web only"
          subtitle="Foraging map requires a web browser."
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
        <Chip label="All" selected={!selectedMonth} onPress={() => setSelectedMonth(undefined)} />
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

        {/* Spot info card */}
        {selectedSpot && !showAddForm && (
          <View style={styles.cardOverlay} pointerEvents="box-none">
            <MapInfoCard title={selectedSpot.type} onClose={() => setSelectedSpot(null)}>
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
            accessibilityLabel="Add foraging spot"
          >
            <Text style={[styles.fabText, { color: colors.text.inverse }]}>+ Add Spot</Text>
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
              Could not load foraging spots
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
