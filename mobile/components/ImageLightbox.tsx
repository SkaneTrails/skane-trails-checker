/**
 * Fullscreen image lightbox.
 *
 * Shows one image at a time scaled to fit the screen. Tapping the image
 * advances to the next image (wrapping) when there is more than one.
 * Tapping the backdrop outside the image closes the viewer.
 */

import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { TabIcon } from './TabIcon';

export interface LightboxImage {
  uri: string;
  caption?: string | null;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  visible: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export function ImageLightbox({ images, visible, onClose, initialIndex = 0 }: ImageLightboxProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);

  // Reset to the requested starting image whenever the viewer (re)opens.
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  if (!visible || images.length === 0) return null;

  const safeIndex = index % images.length;
  const current = images[safeIndex];
  const hasMultiple = images.length > 1;

  const showNext = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (hasMultiple) setIndex((i) => (i + 1) % images.length);
  };

  const handleClose = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={styles.imageArea}
          onPress={showNext}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('trailImages.viewImage')}
        >
          <Image source={{ uri: current.uri }} style={styles.image} resizeMode="contain" />
        </Pressable>

        {!!current.caption && (
          <View style={[styles.captionBar, { backgroundColor: colors.glass.background }]} pointerEvents="none">
            <Text style={[styles.caption, { color: colors.overlayText }]}>{current.caption}</Text>
          </View>
        )}

        {hasMultiple && (
          <View style={styles.counter} pointerEvents="none">
            <Text style={[styles.counterText, { color: colors.overlayText }]}>
              {safeIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.closeButton, { backgroundColor: colors.glass.background }]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('trailImages.closeViewer')}
        >
          <TabIcon name="close" color={colors.overlayText} size={18} strokeWidth={3} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  imageArea: {
    width: '100%',
    height: '85%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  captionBar: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  caption: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  counter: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
