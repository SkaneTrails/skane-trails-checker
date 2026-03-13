import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, FormField, ScreenLayout, StatCard, StatusBadge } from '@/components';
import { useDeleteTrail, useTrail, useTrailDetails, useUpdateTrail } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { data: trail, isLoading: trailLoading } = useTrail(id);
  const { data: details, isLoading: detailsLoading } = useTrailDetails(id);
  const updateTrail = useUpdateTrail();
  const deleteTrail = useDeleteTrail();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (trailLoading || detailsLoading) {
    return (
      <ScreenLayout>
        <EmptyState emoji="⏳" title={t('trail.loadingTrail')} />
      </ScreenLayout>
    );
  }

  if (!trail) {
    return (
      <ScreenLayout>
        <EmptyState
          emoji="🔍"
          title={t('trail.trailNotFound')}
          actionLabel={t('common.goBack')}
          onAction={() => router.back()}
        />
      </ScreenLayout>
    );
  }

  const toggleStatus = () => {
    if (!id) return;
    const newStatus = trail.status === 'Explored!' ? 'To Explore' : 'Explored!';
    updateTrail.mutate({ id, data: { status: newStatus } });
  };

  const startEditing = () => {
    setEditName(trail.name);
    setIsEditing(true);
  };

  const saveRename = () => {
    if (!id || !editName.trim()) return;
    updateTrail.mutate(
      { id, data: { name: editName.trim() } },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const confirmDelete = () => {
    if (!id) return;
    if (Platform.OS === 'web') {
      if (window.confirm(t('trail.deleteConfirm', { name: trail.name }))) {
        deleteTrail.mutate(id, { onSuccess: () => router.back() });
      }
    } else {
      Alert.alert(t('common.delete'), t('trail.deleteConfirm', { name: trail.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteTrail.mutate(id, { onSuccess: () => router.back() }),
        },
      ]);
    }
  };

  return (
    <ScreenLayout>
      <ScrollView contentContainerStyle={styles.content}>
        {isEditing ? (
          <View style={styles.editSection}>
            <FormField label={t('trail.trailName')} value={editName} onChangeText={setEditName} />
            <View style={styles.editButtons}>
              <Button
                title={t('common.save')}
                onPress={saveRename}
                disabled={!editName.trim() || updateTrail.isPending}
              />
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setIsEditing(false)} />
            </View>
          </View>
        ) : (
          <Pressable onLongPress={startEditing}>
            <Text style={[styles.title, { color: colors.primary }]}>{trail.name}</Text>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          <StatCard label={t('trail.distance')} value={`${trail.length_km.toFixed(1)} km`} />
          {trail.elevation_gain != null && (
            <StatCard label={t('trail.elevationGain')} value={`${Math.round(trail.elevation_gain)} m`} />
          )}
          {trail.elevation_loss != null && (
            <StatCard label={t('trail.elevationLoss')} value={`${Math.round(trail.elevation_loss)} m`} />
          )}
          {trail.difficulty && <StatCard label={t('trail.difficultyLabel')} value={trail.difficulty} />}
        </View>

        <View style={styles.statusSection}>
          <Pressable
            style={[
              styles.statusButton,
              {
                backgroundColor:
                  trail.status === 'Explored!'
                    ? colors.status.exploredBg
                    : colors.status.toExploreBg,
              },
            ]}
            onPress={toggleStatus}
            disabled={updateTrail.isPending}
          >
            <Text style={[styles.statusButtonText, { color: colors.text.primary }]}>
              {updateTrail.isPending
                ? t('trail.updating')
                : trail.status === 'Explored!'
                  ? t('trail.exploredStatus')
                  : t('trail.markExplored')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('trail.info')}</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.sourceLabel')}</Text>
            <Text style={[styles.infoText, { color: colors.text.secondary }]}>
              {trail.source.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.statusLabel')}</Text>
            <StatusBadge status={trail.status} />
          </View>
          {trail.last_updated && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.updatedLabel')}</Text>
              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {new Date(trail.last_updated).toLocaleDateString()}
              </Text>
            </View>
          )}
          {trail.activity_date && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.activityLabel')}</Text>
              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {new Date(trail.activity_date).toLocaleDateString()}
              </Text>
            </View>
          )}
          {trail.activity_type && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.typeLabel')}</Text>
              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {trail.activity_type}
              </Text>
            </View>
          )}
          {details && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.muted }]}>{t('trail.trackPoints')}</Text>
              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {details.coordinates_full.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button title={t('trail.rename')} variant="secondary" onPress={startEditing} />
          <Button
            title={t('trail.deleteTrail')}
            variant="danger"
            onPress={confirmDelete}
            disabled={deleteTrail.isPending}
          />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statusSection: {
    marginBottom: spacing.xl,
  },
  statusButton: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  infoSection: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.sm,
  },
  infoText: {
    fontSize: fontSize.md,
  },
  editSection: {
    marginBottom: spacing.lg,
  },
  editButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
