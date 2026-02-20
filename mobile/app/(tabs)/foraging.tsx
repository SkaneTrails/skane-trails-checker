import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useForagingSpots, useForagingTypes } from '@/lib/hooks';
import type { ForagingSpot } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SpotItem({ spot }: { spot: ForagingSpot }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.spotType}>{spot.type}</Text>
        <Text style={styles.spotMonth}>{spot.month}</Text>
      </View>
      {spot.notes ? <Text style={styles.notes}>{spot.notes}</Text> : null}
      <Text style={styles.coords}>
        📍 {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
      </Text>
    </View>
  );
}

export default function ForagingScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>();
  const { data: spots, isLoading, error } = useForagingSpots(selectedMonth);
  const { data: types } = useForagingTypes();

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <Pressable
          style={[styles.monthChip, !selectedMonth && styles.monthChipActive]}
          onPress={() => setSelectedMonth(undefined)}
        >
          <Text style={[styles.monthText, !selectedMonth && styles.monthTextActive]}>All</Text>
        </Pressable>
        {MONTHS.map((m) => (
          <Pressable
            key={m}
            style={[styles.monthChip, selectedMonth === m && styles.monthChipActive]}
            onPress={() => setSelectedMonth(m === selectedMonth ? undefined : m)}
          >
            <Text style={[styles.monthText, selectedMonth === m && styles.monthTextActive]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading spots...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load foraging spots</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SpotItem spot={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            types && types.length > 0 ? (
              <View style={styles.typesRow}>
                {types.map((t) => (
                  <Text key={t.name} style={styles.typeTag}>
                    {t.icon} {t.name}
                  </Text>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No foraging spots found</Text>
            </View>
          }
        />
      )}
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
  monthBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  monthChipActive: {
    backgroundColor: '#1a5e2a',
  },
  monthText: {
    fontSize: 13,
    color: '#333',
  },
  monthTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 12,
    gap: 10,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeTag: {
    fontSize: 13,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    marginBottom: 6,
  },
  spotType: {
    fontSize: 15,
    fontWeight: '600',
  },
  spotMonth: {
    fontSize: 13,
    color: '#666',
  },
  notes: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  coords: {
    fontSize: 12,
    color: '#999',
  },
  error: {
    fontSize: 16,
    color: '#c00',
    fontWeight: 'bold',
  },
});
