import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlaceCategories, usePlaces } from '@/lib/hooks';
import type { Place } from '@/lib/types';

function PlaceItem({ place }: { place: Place }) {
  return (
    <View style={styles.card}>
      <Text style={styles.placeName}>{place.name}</Text>
      {place.city ? (
        <Text style={styles.description} numberOfLines={1}>
          {place.city}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <Text style={styles.coords}>
          📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </Text>
        {place.categories.length > 0 && (
          <View style={styles.categoriesRow}>
            {place.categories.map((cat) => (
              <Text key={cat.slug} style={styles.categoryTag}>
                {cat.icon} {cat.name}
              </Text>
            ))}
          </View>
        )}
      </View>
      {place.weburl ? (
        <Text style={styles.website} numberOfLines={1}>
          🔗 {place.weburl}
        </Text>
      ) : null}
    </View>
  );
}

export default function PlacesScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { data: places, isLoading, error } = usePlaces(selectedCategory);
  const { data: categories } = usePlaceCategories();

  const categoryEntries = categories ? Object.entries(categories) : [];

  return (
    <View style={styles.container}>
      {categoryEntries.length > 0 && (
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>
              All
            </Text>
          </Pressable>
          {categoryEntries.map(([slug, cat]) => (
            <Pressable
              key={slug}
              style={[styles.filterChip, selectedCategory === slug && styles.filterChipActive]}
              onPress={() => setSelectedCategory(slug === selectedCategory ? undefined : slug)}
            >
              <Text
                style={[styles.filterText, selectedCategory === slug && styles.filterTextActive]}
              >
                {cat.icon} {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <Text>Loading places...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load places</Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => <PlaceItem place={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No places found</Text>
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
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  filterChipActive: {
    backgroundColor: '#1a5e2a',
  },
  filterText: {
    fontSize: 13,
    color: '#333',
  },
  filterTextActive: {
    color: '#fff',
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
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
  },
  cardMeta: {
    gap: 6,
  },
  coords: {
    fontSize: 12,
    color: '#999',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryTag: {
    fontSize: 12,
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    color: '#1565c0',
  },
  website: {
    fontSize: 13,
    color: '#1a5e2a',
    marginTop: 6,
  },
  error: {
    fontSize: 16,
    color: '#c00',
    fontWeight: 'bold',
  },
});
