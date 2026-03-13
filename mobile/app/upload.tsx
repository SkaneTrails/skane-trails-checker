/**
 * GPX upload screen.
 *
 * Web-first: uses a hidden <input type="file"> for file selection.
 * Uploads to POST /api/v1/trails/upload and shows results.
 */

import { useRouter } from 'expo-router';
import { type ChangeEvent, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, ContentCard, EmptyState } from '@/components';
import { TabIcon } from '@/components/TabIcon';
import { useUploadGpx } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, sheet, spacing, useTheme } from '@/lib/theme';
import { cssShadow, glassSheet } from '@/lib/theme/styles';
import type { Trail } from '@/lib/types';

const SOURCE_OPTIONS = [
  { label: 'Other Trails', value: 'other_trails' },
  { label: 'World Wide Hikes', value: 'world_wide_hikes' },
] as const;

export default function UploadScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const upload = useUploadGpx();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [source, setSource] = useState('other_trails');
  const [uploadedTrails, setUploadedTrails] = useState<Trail[] | null>(null);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.backdrop}>
        <View style={styles.cardWrap}>
          <EmptyState
            title={t('upload.webOnly')}
            actionLabel={t('common.goBack')}
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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

  const glass = glassSheet(colors.glass);

  return (
    <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View
        style={[
          styles.cardWrap,
          glass,
          shadows.elevated,
          {
            boxShadow: cssShadow(shadows, 'elevated'),
          } as any,
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.text.muted, opacity: 0.3 }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {t('upload.title')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeButton}
            accessibilityLabel={t('common.cancel')}
          >
            <TabIcon name="close" color={colors.text.muted} size={20} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.heading, { color: colors.text.primary }]}>
            {t('upload.heading')}
          </Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {t('upload.description')}
        </Text>

        <View style={styles.sourceSection}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>
            {t('upload.trailSource')}
          </Text>
          <View style={styles.chipRow}>
            {SOURCE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={t(
                  `upload.${opt.value === 'other_trails' ? 'otherTrails' : 'worldWideHikes'}`,
                )}
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
            style={{ marginBottom: spacing.md }}
          />
          {selectedFile && (
            <Text style={[styles.fileName, { color: colors.text.secondary }]}>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title={upload.isPending ? t('upload.uploading') : t('upload.upload')}
            onPress={handleUpload}
            disabled={!selectedFile || upload.isPending}
          />
        </View>

        {upload.isError && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {upload.error?.message ?? t('upload.uploadFailed')}
            </Text>
          </View>
        )}

        {uploadedTrails && (
          <View style={styles.results}>
            <Text style={[styles.resultHeading, { color: colors.success }]}>
              {t('upload.uploadSuccess', { count: String(uploadedTrails.length) })}
            </Text>
            {uploadedTrails.map((trail) => (
              <ContentCard key={trail.trail_id}>
                <Text style={[styles.trailName, { color: colors.text.primary }]}>{trail.name}</Text>
                <Text style={[styles.trailMeta, { color: colors.text.secondary }]}>
                  {trail.length_km.toFixed(1)} km
                </Text>
              </ContentCard>
            ))}
            <View style={styles.actions}>
              <Button
                title={t('upload.viewTrails')}
                onPress={() => router.push('/(tabs)/trails')}
              />
            </View>
          </View>
        )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardWrap: {
    maxHeight: '85%',
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: sheet.handleWidth,
    height: sheet.handleHeight,
    borderRadius: borderRadius.full,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
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
