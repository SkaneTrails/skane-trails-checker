/**
 * Overlay edit panel shown while aligning a map image overlay.
 *
 * Corner positioning and rotation are done directly on the map via draggable
 * handles; this panel only exposes opacity, reset, delete and done controls.
 */

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import type { MapOverlay } from '@/lib/map-overlays';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassSheet } from '@/lib/theme/styles';
import { Button } from './Button';

interface OverlayEditPanelProps {
  overlay: MapOverlay;
  onUpdateOpacity: (opacity: number) => void;
  onReset: () => void;
  onDelete: () => void;
  onDone: () => void;
}

const OPACITY_STEPS = [0.25, 0.5, 0.75, 1.0];

export function OverlayEditPanel({
  overlay,
  onUpdateOpacity,
  onReset,
  onDelete,
  onDone,
}: OverlayEditPanelProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[styles.panel, glassSheet(colors.glass), Platform.OS === 'web' && styles.panelWeb]}
    >
      <Text style={[styles.instructions, { color: colors.text.muted }]}>
        {t('overlays.dragHandles')}
      </Text>

      <View style={styles.opacityRow}>
        <Text style={[styles.label, { color: colors.text.muted }]}>{t('overlays.opacity')}:</Text>
        {OPACITY_STEPS.map((step) => {
          const active = Math.abs(overlay.opacity - step) < 0.01;
          return (
            <Pressable
              key={step}
              onPress={() => onUpdateOpacity(step)}
              style={[
                styles.opacityButton,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.opacityText,
                  { color: active ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {Math.round(step * 100)}%
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button title={t('overlays.delete')} variant="danger" onPress={onDelete} />
        <Button title={t('overlays.reset')} variant="secondary" onPress={onReset} />
        <Button title={t('overlays.done')} variant="primary" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    zIndex: 1000,
  },
  panelWeb: {
    maxWidth: 520,
    alignSelf: 'center',
  },
  instructions: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  opacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  opacityButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  opacityText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});

export type { OverlayEditPanelProps };
