/**
 * Foraging spots list drawer — month filter + spot list.
 *
 * Accessible from the hamburger menu. Shows foraging spots
 * with month filtering, similar to the old foraging tab.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Chip } from '@/components/Chip';
import { ContentCard } from '@/components/ContentCard';
import { DrawerOverlay } from '@/components/DrawerOverlay';
import { EmptyState } from '@/components/EmptyState';
import { foragingColorMap } from '@/lib/foraging-colors';
import { useForagingSpots, useForagingTypes } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { ForagingSpot } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ForagingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSpot: () => void;
}

function SpotItem({ spot, typeColor }: { spot: ForagingSpot; typeColor: string }) {
  const { colors } = useTheme();

  return (
    <ContentCard>
      <View style={styles.spotHeader}>
        <View style={styles.spotTitleRow}>
          <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />
          <Text style={[styles.spotName, { color: colors.text.primary }]}>{spot.type}</Text>
        </View>
        <View style={styles.monthTagsRow}>
          {spot.months.map((m) => (
            <Text
              key={m}
              style={[
                styles.monthTag,
                { backgroundColor: colors.tag.foragingBg, color: colors.tag.foragingText },
              ]}
            >
              {m}
            </Text>
          ))}
        </View>
      </View>
      {spot.notes ? (
        <Text style={[styles.spotNotes, { color: colors.text.secondary }]} numberOfLines={2}>
          {spot.notes}
        </Text>
      ) : null}
      <Text style={[styles.coords, { color: colors.text.muted }]}>
        {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>
    </ContentCard>
  );
}

export const ForagingDrawer = ({ isOpen, onClose, onAddSpot }: ForagingDrawerProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isLoading, isFetching, isError, refetch } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();
  const colorMap = foragingColorMap(types ?? []);

  return (
    <DrawerOverlay isOpen={isOpen} title={t('tabs.foraging')} onClose={onClose}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={[styles.summaryText, { color: colors.text.primary }]}>
          {spots?.length ?? 0} {t('foraging.spots')}
        </Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            onClose();
            onAddSpot();
          }}
        >
          <Text style={[styles.addButtonText, { color: colors.text.inverse }]}>
            {t('foraging.addSpot')}
          </Text>
        </Pressable>
      </View>

      {/* Month filter */}
      <View style={styles.filterBar}>
        <Chip
          label={t('common.all')}
          selected={!selectedMonth}
          onPress={() => setSelectedMonth(undefined)}
        />
        {MONTHS.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={selectedMonth === m}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          />
        ))}
      </View>

      {isError && !spots?.length ? (
        <EmptyState
          emoji="⚠️"
          title={t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      ) : isLoading ? (
        <EmptyState title={t('foraging.loadingSpots')} />
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SpotItem spot={item} typeColor={colorMap.get(item.type) ?? colors.text.muted} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title={t('foraging.noSpotsFound')} />}
          ListHeaderComponent={
            isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null
          }
        />
      )}
    </DrawerOverlay>
  );
};

const styles = StyleSheet.create({
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  spotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  monthTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  typeIndicator: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  spotName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  monthTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    overflow: 'hidden',
  },
  spotNotes: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  coords: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
