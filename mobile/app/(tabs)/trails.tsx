import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTrails } from '@/lib/hooks';
import type { Trail } from '@/lib/types';

function TrailItem({ trail }: { trail: Trail }) {
  const router = useRouter();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/trail/${trail.trail_id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.trailName} numberOfLines={1}>
          {trail.name}
        </Text>
        <View
          style={[
            styles.statusBadge,
            trail.status === 'Explored!' ? styles.explored : styles.toExplore,
          ]}
        >
          <Text style={styles.statusText}>{trail.status}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>📏 {trail.length_km.toFixed(1)} km</Text>
        {trail.difficulty && <Text style={styles.metaText}>⛰️ {trail.difficulty}</Text>}
        <Text style={styles.metaText}>📂 {trail.source.replace(/_/g, ' ')}</Text>
      </View>
    </Pressable>
  );
}

export default function TrailsScreen() {
  const { data: trails, isLoading, error, refetch } = useTrails();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading trails...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load trails</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const explored = trails?.filter((t) => t.status === 'Explored!').length ?? 0;
  const total = trails?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          🥾 {explored} / {total} explored
        </Text>
      </View>
      <FlatList
        data={trails}
        keyExtractor={(item) => item.trail_id}
        renderItem={({ item }) => <TrailItem trail={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No trails found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  summary: {
    backgroundColor: '#1a5e2a',
    padding: 12,
    alignItems: 'center',
  },
  summaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trailName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  explored: {
    backgroundColor: '#d4edda',
  },
  toExplore: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  error: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c00',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1a5e2a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
