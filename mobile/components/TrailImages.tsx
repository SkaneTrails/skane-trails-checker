/**
 * Trail images panel — shows uploaded photos with upload button.
 * Displayed as a tab in the trail card / detail view.
 */

import React, { useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDeleteTrailImage, useTrailImages, useUploadTrailImage } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { TabIcon } from './TabIcon';

interface TrailImagesProps {
  trailId: string;
  canEdit?: boolean;
}

export function TrailImages({ trailId, canEdit }: TrailImagesProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { data: imagesData } = useTrailImages(trailId);
  const uploadImage = useUploadTrailImage();
  const deleteImage = useDeleteTrailImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadRole, setUploadRole] = useState<'primary' | 'secondary'>('secondary');

  const images = imagesData?.images ?? [];
  const primaryImage = images.find((img) => img.role === 'primary');
  const secondaryImages = images.filter((img) => img.role === 'secondary');
  const canUpload = canEdit && images.length < 3;
  const hasPrimary = !!primaryImage;

  const handleFileSelect = async (role: 'primary' | 'secondary') => {
    if (Platform.OS === 'web') {
      setUploadRole(role);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }

    // Native: use expo-image-picker
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    uploadImage.mutate({
      trailId,
      file: { uri: asset.uri, type: mimeType, name: `photo.${ext}` },
      role,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadImage.mutate({ trailId, file, role: uploadRole });
    // Reset input so the same file can be re-selected
    event.target.value = '';
  };

  const handleDelete = (index: number) => {
    const doDelete = () => deleteImage.mutate({ trailId, imageIndex: index });
    if (Platform.OS === 'web') {
      if (window.confirm(t('trailImages.deleteConfirm'))) doDelete();
    } else {
      Alert.alert(t('trailImages.deleteImage'), t('trailImages.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Hidden file input for web */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange as any}
        />
      )}

      {images.length === 0 && !canEdit && (
        <Text style={[styles.emptyText, { color: colors.text.muted }]}>
          {t('trailImages.noPhotos')}
        </Text>
      )}

      {/* Primary image */}
      {primaryImage && (
        <View style={styles.imageSection}>
          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
            {t('trailImages.primaryPhoto')}
          </Text>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${primaryImage.image_data}` }}
              style={[styles.primaryImage, { borderColor: colors.border }]}
              resizeMode="cover"
            />
            {primaryImage.caption && (
              <Text style={[styles.caption, { color: colors.text.secondary }]}>
                {primaryImage.caption}
              </Text>
            )}
            {primaryImage.lat != null && primaryImage.lng != null && (
              <Text style={[styles.gpsTag, { color: colors.text.muted }]}>
                📍 {primaryImage.lat.toFixed(4)}, {primaryImage.lng.toFixed(4)}
              </Text>
            )}
            {canEdit && (
              <Pressable
                style={[styles.deleteImageButton, { backgroundColor: colors.error }]}
                onPress={() => handleDelete(images.indexOf(primaryImage))}
                accessibilityLabel={t('trailImages.deleteImage')}
                accessibilityRole="button"
              >
                <TabIcon name="close" color={colors.text.inverse} size={12} strokeWidth={3} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Secondary images */}
      {secondaryImages.length > 0 && (
        <View style={styles.imageSection}>
          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
            {t('trailImages.morePhotos')}
          </Text>
          <View style={styles.secondaryGrid}>
            {secondaryImages.map((img) => {
              const globalIndex = images.indexOf(img);
              return (
                <View key={globalIndex} style={styles.secondaryItem}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${img.image_data}` }}
                    style={[styles.secondaryImage, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                  {img.caption && (
                    <Text style={[styles.captionSmall, { color: colors.text.secondary }]} numberOfLines={1}>
                      {img.caption}
                    </Text>
                  )}
                  {canEdit && (
                    <Pressable
                      style={[styles.deleteImageButton, { backgroundColor: colors.error }]}
                      onPress={() => handleDelete(globalIndex)}
                      accessibilityLabel={t('trailImages.deleteImage')}
                      accessibilityRole="button"
                    >
                      <TabIcon name="close" color={colors.text.inverse} size={10} strokeWidth={3} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Upload buttons */}
      {canUpload && (
        <View style={styles.uploadSection}>
          {!hasPrimary && (
            <Pressable
              style={[styles.uploadButton, { borderColor: colors.primary }]}
              onPress={() => handleFileSelect('primary')}
              disabled={uploadImage.isPending}
            >
              <TabIcon name="image" color={colors.primary} size={16} strokeWidth={2} />
              <Text style={[styles.uploadText, { color: colors.primary }]}>
                {uploadImage.isPending ? t('trailImages.uploading') : t('trailImages.addPrimary')}
              </Text>
            </Pressable>
          )}
          {secondaryImages.length < 2 && (
            <Pressable
              style={[styles.uploadButton, { borderColor: colors.text.muted }]}
              onPress={() => handleFileSelect('secondary')}
              disabled={uploadImage.isPending}
            >
              <TabIcon name="image" color={colors.text.muted} size={16} strokeWidth={2} />
              <Text style={[styles.uploadText, { color: colors.text.muted }]}>
                {uploadImage.isPending ? t('trailImages.uploading') : t('trailImages.addPhoto')}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {uploadImage.isError && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {t('trailImages.uploadFailed')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  imageSection: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  imageWrapper: {
    position: 'relative',
  },
  primaryImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  caption: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  gpsTag: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  secondaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryItem: {
    flex: 1,
    position: 'relative',
  },
  secondaryImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  captionSmall: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  deleteImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSection: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  errorText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
