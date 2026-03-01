import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTrail, useTrailDetails, useUpdateTrail } from '@/lib/hooks';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trail, isLoading: trailLoading } = useTrail(id);
  const { data: details, isLoading: detailsLoading } = useTrailDetails(id);
  const updateTrail = useUpdateTrail();

  if (trailLoading || detailsLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading trail...</Text>
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Trail not found</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const toggleStatus = () => {
    if (!id) return;
    const newStatus = trail.status === 'Explored!' ? 'To Explore' : 'Explored!';
    updateTrail.mutate({ id, data: { status: newStatus } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{trail.name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{trail.length_km.toFixed(1)} km</Text>
        </View>
        {trail.elevation_gain != null && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Elevation Gain</Text>
            <Text style={styles.statValue}>{Math.round(trail.elevation_gain)} m</Text>
          </View>
        )}
        {trail.elevation_loss != null && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Elevation Loss</Text>
            <Text style={styles.statValue}>{Math.round(trail.elevation_loss)} m</Text>
          </View>
        )}
        {trail.difficulty && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Difficulty</Text>
            <Text style={styles.statValue}>{trail.difficulty}</Text>
          </View>
        )}
      </View>

      <View style={styles.statusSection}>
        <Pressable
          style={[
            styles.statusButton,
            trail.status === 'Explored!' ? styles.exploredButton : styles.toExploreButton,
          ]}
          onPress={toggleStatus}
          disabled={updateTrail.isPending}
        >
          <Text style={styles.statusButtonText}>
            {updateTrail.isPending
              ? 'Updating...'
              : trail.status === 'Explored!'
                ? '✅ Explored!'
                : '🔴 Mark as Explored'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Info</Text>
        <Text style={styles.infoText}>Source: {trail.source.replace(/_/g, ' ')}</Text>
        {trail.last_updated && (
          <Text style={styles.infoText}>
            Last updated: {new Date(trail.last_updated).toLocaleDateString()}
          </Text>
        )}
        {trail.activity_date && (
          <Text style={styles.infoText}>
            Activity date: {new Date(trail.activity_date).toLocaleDateString()}
          </Text>
        )}
        {trail.activity_type && (
          <Text style={styles.infoText}>Activity: {trail.activity_type}</Text>
        )}
        {details && (
          <Text style={styles.infoText}>Track points: {details.coordinates_full.length}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a5e2a',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  stat: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statusSection: {
    marginBottom: 20,
  },
  statusButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  exploredButton: {
    backgroundColor: '#d4edda',
  },
  toExploreButton: {
    backgroundColor: '#f8d7da',
  },
  statusButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  error: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c00',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1a5e2a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
