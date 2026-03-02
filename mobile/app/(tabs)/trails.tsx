import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, ContentCard, EmptyState, ScreenLayout, StatusBadge } from '@/components';
import type { TrailFilters } from '@/lib/api';
import { useTrails } from '@/lib/hooks';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Trail } from '@/lib/types';

const STATUS_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Explored', value: 'Explored!' },
  { label: 'To Explore', value: 'To Explore' },
] as const;

function TrailItem({ trail }: { trail: Trail }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable onPress={() => router.push(`/trail/${trail.trail_id}`)}>
      <ContentCard>
        <View style={styles.cardHeader}>
          <Text style={[styles.trailName, { color: colors.text.primary }]} numberOfLines={1}>
            {trail.name}
          </Text>
          <StatusBadge status={trail.status} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.text.secondary }]}>
            📏 {trail.length_km.toFixed(1)} km
          </Text>
          {trail.difficulty && (
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              ⛰️ {trail.difficulty}
            </Text>
          )}
          <Text style={[styles.metaText, { color: colors.text.secondary }]}>
            📂 {trail.source.replace(/_/g, ' ')}
          </Text>
        </View>
      </ContentCard>
    </Pressable>
  );
}

export default function TrailsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const filters: TrailFilters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data: trails, isLoading, isFetching, error, refetch } = useTrails(filters);

  const explored = trails?.filter((t) => t.status === 'Explored!').length ?? 0;
  const total = trails?.length ?? 0;

  if (error && !trails?.length) {
    return (
      <ScreenLayout>
        <EmptyState
          emoji="⚠️"
          title="Failed to load trails"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={[styles.summary, { backgroundColor: colors.primary }]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryText, { color: colors.text.inverse }]}>
            🥾 {explored} / {total} explored
          </Text>
          {isFetching && (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          )}
        </View>
        <Pressable style={styles.uploadButton} onPress={() => router.push('/upload')}>
          <Text style={[styles.uploadButtonText, { color: colors.text.inverse }]}>
            📤 Upload GPX
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.filterBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
        ]}
      >
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text.primary,
            },
          ]}
          placeholder="Search trails..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.label}
              label={opt.label}
              selected={statusFilter === opt.value}
              onPress={() => setStatusFilter(opt.value)}
            />
          ))}
        </View>
      </View>

      {isLoading && !trails?.length ? (
        <EmptyState emoji="⏳" title="Loading trails..." />
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.trail_id}
          renderItem={({ item }) => <TrailItem trail={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState emoji="🥾" title="No trails found" />}
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
    padding: spacing.md,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  uploadButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  uploadButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  filterBar: {
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
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
    flex: 1,
    marginRight: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metaText: {
    fontSize: fontSize.sm,
  },
});
