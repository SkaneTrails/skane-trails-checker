import { Platform, StyleSheet, Text, View } from 'react-native';
import { TrailMap } from '@/components/TrailMap';
import { useTrails } from '@/lib/hooks';

export default function MapScreen() {
  const { data: trails, isLoading, error } = useTrails();

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text>Map is currently available on web only.</Text>
        <Text>Use the Trails tab to see your trails.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TrailMap trails={trails ?? []} />
      {isLoading && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Loading trails...</Text>
        </View>
      )}
      {error && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Could not connect to API — showing empty map</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  overlayText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    overflow: 'hidden',
  },
});
