/**
 * GPX upload screen.
 *
 * Web-first: uses a hidden <input type="file"> for file selection.
 * Uploads to POST /api/v1/trails/upload and shows results.
 */

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, ContentCard, EmptyState, ScreenLayout } from '@/components';
import { useUploadGpx } from '@/lib/hooks';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import type { Trail } from '@/lib/types';

const SOURCE_OPTIONS = [
  { label: 'Other Trails', value: 'other_trails' },
  { label: 'World Wide Hikes', value: 'world_wide_hikes' },
] as const;

export default function UploadScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const upload = useUploadGpx();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [source, setSource] = useState('other_trails');
  const [uploadedTrails, setUploadedTrails] = useState<Trail[] | null>(null);

  if (Platform.OS !== 'web') {
    return (
      <ScreenLayout>
        <EmptyState
          emoji="📁"
          title="GPX upload is currently available on web only"
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </ScreenLayout>
    );
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedTrails(null);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    upload.mutate(
      { file: selectedFile, source },
      {
        onSuccess: (trails) => {
          setUploadedTrails(trails);
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      },
    );
  };

  return (
    <ScreenLayout>
      <View style={styles.content}>
        <Text style={[styles.heading, { color: colors.text.primary }]}>Upload GPX File</Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Upload a .gpx file to add trails. Uploaded trails are automatically marked as explored.
        </Text>

        <View style={styles.sourceSection}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>Trail Source</Text>
          <View style={styles.chipRow}>
            {SOURCE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={source === opt.value}
                onPress={() => setSource(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.fileSection}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            onChange={handleFileChange}
            style={{ marginBottom: 12 }}
          />
          {selectedFile && (
            <Text style={[styles.fileName, { color: colors.text.secondary }]}>
              📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title={upload.isPending ? 'Uploading...' : '📤 Upload'}
            onPress={handleUpload}
            disabled={!selectedFile || upload.isPending}
          />
        </View>

        {upload.isError && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {upload.error?.message ?? 'Upload failed'}
            </Text>
          </View>
        )}

        {uploadedTrails && (
          <View style={styles.results}>
            <Text style={[styles.resultHeading, { color: colors.success }]}>
              ✅ {uploadedTrails.length} trail(s) uploaded successfully!
            </Text>
            {uploadedTrails.map((trail) => (
              <ContentCard key={trail.trail_id}>
                <Text style={[styles.trailName, { color: colors.text.primary }]}>{trail.name}</Text>
                <Text style={[styles.trailMeta, { color: colors.text.secondary }]}>
                  📏 {trail.length_km.toFixed(1)} km
                </Text>
              </ContentCard>
            ))}
            <View style={styles.actions}>
              <Button title="View Trails" onPress={() => router.push('/(tabs)/trails')} />
            </View>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.md,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  sourceSection: {
    marginBottom: spacing.xl,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fileSection: {
    marginBottom: spacing.xl,
  },
  fileName: {
    fontSize: fontSize.sm,
  },
  actions: {
    marginBottom: spacing.lg,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  results: {
    gap: spacing.md,
  },
  resultHeading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  trailName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  trailMeta: {
    fontSize: fontSize.sm,
  },
});
