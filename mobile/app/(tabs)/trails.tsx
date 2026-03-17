import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout, StatusBadge } from '@/components';
import { filterTrails, useTrails } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, letterSpacing, spacing, useTheme } from '@/lib/theme';
import { glassPill } from '@/lib/theme/styles';
import type { Trail } from '@/lib/types';

function TrailItem({ trail }: { trail: Trail }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable onPress={() => router.navigate({ pathname: '/(tabs)', params: { trailId: trail.trail_id } })}>
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

export default function TrailsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const statusOptions = [
    { label: t('common.all'), value: undefined },
    { label: t('trails.explored'), value: 'Explored!' },
    { label: t('trails.toExplore'), value: 'To Explore' },
  ] as const;

  const { data: allTrails, isLoading, isFetching, error, refetch } = useTrails();

  const trails = useMemo(
    () => filterTrails(allTrails ?? [], { search: search.trim() || undefined, status: statusFilter }),
    [allTrails, search, statusFilter],
  );

  const trailCount = trails.length;
  const explored = trails.filter((tr) => tr.status === 'Explored!').length;

  if (error && trailCount === 0) {
    return (
      <ScreenLayout title={t('tabs.trails')}>
        <EmptyState
          title={t('trails.failedToLoad')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={t('tabs.trails')}>
      <View style={[styles.summary, glassPill(colors.glass)]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryText, { color: colors.text.primary }]}>
            {t('trails.exploredCount', { explored: String(explored), total: String(trailCount) })}
          </Text>
          {isFetching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <Pressable
          style={[styles.uploadButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/upload')}
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
            Platform.OS === 'web' &&
              ({
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              } as any),
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

      {isLoading && trailCount === 0 ? (
        <EmptyState title={t('trails.loadingTrails')} />
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.trail_id}
          renderItem={({ item }) => <TrailItem trail={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t('trails.noTrailsFound')} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    margin: spacing.lg,
    marginBottom: 0,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.lg,
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
    padding: spacing.lg,
    gap: spacing.md,
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
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 100,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trailName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  metaChipText: {
    fontSize: fontSize.xs,
  },
  sourceText: {
    fontSize: fontSize.xs,
  },
});
