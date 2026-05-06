/**
 * Overlay manager panel for map image overlays.
 *
 * Lists overlays with visibility toggle, edit, and delete controls.
 * Supports adding new overlays from gallery or camera.
 */

import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MapOverlay } from '@/lib/map-overlays';
import {
  captureImageFromCamera,
  deleteOverlayImage,
  pickImageFromGallery,
} from '@/lib/overlay-image-picker';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { cssShadow, glassSheet } from '@/lib/theme/styles';
import { Button } from './Button';
import { TabIcon } from './TabIcon';

interface OverlayManagerProps {
  overlays: MapOverlay[];
  onAddOverlay: (imageUri: string, name: string) => Promise<void>;
  onToggleVisibility: (id: string) => void;
  onDeleteOverlay: (id: string) => Promise<void>;
  onEditOverlay: (id: string) => void;
  onClose: () => void;
}

export function OverlayManager({
  overlays,
  onAddOverlay,
  onToggleVisibility,
  onDeleteOverlay,
  onEditOverlay,
  onClose,
}: OverlayManagerProps) {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);

  const handlePickGallery = useCallback(async () => {
    const uri = await pickImageFromGallery();
    if (uri) {
      const name = `Overlay ${overlays.length + 1}`;
      await onAddOverlay(uri, name);
    }
  }, [overlays.length, onAddOverlay]);

  const handleTakePhoto = useCallback(async () => {
    const uri = await captureImageFromCamera();
    if (uri) {
      const name = `Overlay ${overlays.length + 1}`;
      await onAddOverlay(uri, name);
    }
  }, [overlays.length, onAddOverlay]);

  const handleDelete = useCallback(
    (overlay: MapOverlay) => {
      const doDelete = async () => {
        await deleteOverlayImage(overlay.imageUri);
        await onDeleteOverlay(overlay.id);
      };

      if (Platform.OS === 'web') {
        if (window.confirm(t('overlays.deleteConfirm'))) {
          void doDelete();
        }
      } else {
        Alert.alert(t('overlays.delete'), t('overlays.deleteConfirm'), [
          { text: t('overlays.cancel'), style: 'cancel' },
          { text: t('overlays.delete'), style: 'destructive', onPress: () => void doDelete() },
        ]);
      }
    },
    [onDeleteOverlay, t]
  );

  return (
    <View
      style={[
        styles.card,
        glassSheet(colors.glass),
        Platform.OS === 'web' &&
          ({
            boxShadow: cssShadow(shadows, 'elevated'),
          } as Record<string, unknown>),
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('overlays.title')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('overlays.cancel')}
        >
          {Platform.OS === 'web' ? (
            <TabIcon name="close" color={colors.text.muted} size={24} />
          ) : (
            <Text style={[styles.overlayMeta, { color: colors.text.muted }]}>✕</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
        {overlays.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text.muted }]}>
            {t('overlays.noOverlays')}
          </Text>
        ) : (
          overlays.map((overlay) => (
            <View
              key={overlay.id}
              style={[styles.overlayRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={styles.overlayInfo}>
                <Text style={[styles.overlayName, { color: colors.text.primary }]}>
                  {overlay.name}
                </Text>
                <Text style={[styles.overlayMeta, { color: colors.text.muted }]}>
                  {Math.round(overlay.opacity * 100)}% {t('overlays.opacity').toLowerCase()}
                </Text>
              </View>
              <View style={styles.overlayActions}>
                <Pressable
                  onPress={() => onToggleVisibility(overlay.id)}
                  hitSlop={8}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={overlay.visible ? t('overlays.toggleVisibility') : t('overlays.toggleVisibility')}
                >
                  {Platform.OS === 'web' ? (
                    <TabIcon
                      name={overlay.visible ? 'eye' : 'eye-off'}
                      color={overlay.visible ? colors.primary : colors.text.muted}
                      size={20}
                    />
                  ) : (
                    <Text style={[styles.overlayMeta, { color: overlay.visible ? colors.primary : colors.text.muted }]}>
                      {overlay.visible ? '👁' : '🙈'}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => onEditOverlay(overlay.id)}
                  hitSlop={8}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('overlays.edit')}
                >
                  {Platform.OS === 'web' ? (
                    <TabIcon name="edit" color={colors.text.muted} size={20} />
                  ) : (
                    <Text style={[styles.overlayMeta, { color: colors.text.muted }]}>✏️</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(overlay)}
                  hitSlop={8}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('overlays.delete')}
                >
                  {Platform.OS === 'web' ? (
                    <TabIcon name="trash" color={colors.error} size={20} />
                  ) : (
                    <Text style={[styles.overlayMeta, { color: colors.error }]}>🗑️</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {isAdding ? (
        <View style={styles.addOptions}>
          <Button
            title={t('overlays.pickFromGallery')}
            variant="secondary"
            onPress={() => {
              void handlePickGallery();
              setIsAdding(false);
            }}
          />
          <Button
            title={t('overlays.takePhoto')}
            variant="secondary"
            onPress={() => {
              void handleTakePhoto();
              setIsAdding(false);
            }}
          />
          <Button title={t('overlays.cancel')} variant="glass" onPress={() => setIsAdding(false)} />
        </View>
      ) : (
        <Button
          title={t('overlays.addOverlay')}
          variant="primary"
          onPress={() => setIsAdding(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    maxWidth: 400,
    maxHeight: 500,
    width: '90%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  overlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  overlayInfo: {
    flex: 1,
  },
  overlayName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  overlayMeta: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  addOptions: {
    gap: spacing.sm,
  },
});
