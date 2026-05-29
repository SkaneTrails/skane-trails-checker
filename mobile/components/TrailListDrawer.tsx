/**
 * Trail list drawer — searchable, filterable list of trails.
 *
 * Accessible from the hamburger menu. Tapping a trail navigates
 * back to the map with that trail selected.
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Chip } from '@/components/Chip';
import { ContentCard } from '@/components/ContentCard';
import { DrawerOverlay } from '@/components/DrawerOverlay';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { filterTrails, useTrails } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';
import type { Trail } from '@/lib/types';

interface TrailListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTrailSelect: (trail: Trail) => void;
  onUpload: () => void;
}

function TrailItem({ trail, onPress }: { trail: Trail; onPress: (trail: Trail) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable onPress={() => onPress(trail)}>
      <ContentCard>
        <View style={styles.cardHeader}>
          <Text style={[styles.trailName, { color: colors.text.primary }]} numberOfLines={1}>
            {trail.name}
          </Text>
          <StatusBadge status={trail.status} />
        </View>
        <View style={styles.cardMeta}>
          <View style={[styles.metaChip, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.metaChipText, { color: colors.primaryDark }]}>
              {t('trails.distance', { km: trail.length_km.toFixed(1) })}
            </Text>
          </View>
          {!!trail.difficulty && (
            <View style={[styles.metaChip, { backgroundColor: colors.status.toExploreBg }]}>
              <Text style={[styles.metaChipText, { color: colors.status.toExploreText }]}>
                {trail.difficulty}
              </Text>
            </View>
          )}
          <Text style={[styles.sourceText, { color: colors.text.muted }]}>
            {trail.source.replace(/_/g, ' ')}
          </Text>
        </View>
      </ContentCard>
    </Pressable>
  );
}

export const TrailListDrawer = ({ isOpen, onClose, onTrailSelect, onUpload }: TrailListDrawerProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const statusOptions = [
    { label: t('common.all'), value: undefined },
    { label: t('trails.explored'), value: 'Explored!' },
    { label: t('trails.toExplore'), value: 'To Explore' },
  ] as const;

  const { data: allTrails, isLoading, isFetching, isError, refetch } = useTrails();

  const trails = useMemo(
    () => filterTrails(allTrails ?? [], { search: search.trim() || undefined, status: statusFilter as Trail['status'] | undefined }),
    [allTrails, search, statusFilter],
  );

  const trailCount = trails.length;
  const explored = trails.filter((tr) => tr.status === 'Explored!').length;

  const handleTrailPress = (trail: Trail) => {
    onClose();
    onTrailSelect(trail);
  };

  return (
    <DrawerOverlay isOpen={isOpen} title={t('tabs.trails')} onClose={onClose}>
      <View style={[styles.summary, glassPill(colors.glass)]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryText, { color: colors.text.primary }]}>
            {t('trails.exploredCount', { explored: String(explored), total: String(trailCount) })}
          </Text>
          {isFetching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <Pressable
          style={[styles.uploadButton, { backgroundColor: colors.primary }]}
          onPress={onUpload}
        >
          <Text style={[styles.uploadButtonText, { color: colors.text.inverse }]}>
            {t('trails.uploadGpx')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.glass.background,
              borderColor: colors.glass.borderSubtle,
              color: colors.text.primary,
            },
          ]}
          placeholder={t('trails.searchPlaceholder')}
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.chipRow}>
          {statusOptions.map((opt) => (
            <Chip
              key={opt.label}
              label={opt.label}
              selected={statusFilter === opt.value}
              onPress={() => setStatusFilter(opt.value)}
            />
          ))}
        </View>
      </View>

      {isError && trailCount === 0 ? (
        <EmptyState
          emoji="⚠️"
          title={t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      ) : isLoading && trailCount === 0 ? (
        <EmptyState title={t('trails.loadingTrails')} />
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.trail_id}
          renderItem={({ item }) => <TrailItem trail={item} onPress={handleTrailPress} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t('trails.noTrailsFound')} />}
        />
      )}
    </DrawerOverlay>
  );
};

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  uploadButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  uploadButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  filterBar: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trailName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  metaChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  sourceText: {
    fontSize: fontSize.xs,
  },
});
