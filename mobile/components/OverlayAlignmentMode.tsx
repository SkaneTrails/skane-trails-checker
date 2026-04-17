/**
 * Overlay alignment mode for repositioning image overlay corners.
 *
 * Renders draggable corner markers and controls for adjusting
 * opacity and completing alignment. Uses tap-to-place approach:
 * tap a corner to select, tap map to place.
 */

import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MapOverlay } from '@/lib/map-overlays';
import { rotateCorners } from '@/lib/map-overlays';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassSheet } from '@/lib/theme/styles';
import { Button } from './Button';
import { TabIcon } from './TabIcon';

/**
 * Corners are indexed as:
 * 0: top-left
 * 1: top-right
 * 2: bottom-right
 * 3: bottom-left
 */
type CornerIndex = 0 | 1 | 2 | 3;

interface OverlayAlignmentModeProps {
  overlay: MapOverlay;
  onUpdateCorners: (corners: MapOverlay['corners']) => void;
  onUpdateOpacity: (opacity: number) => void;
  onDone: () => void;
  onReset: () => void;
}

const CORNER_LABELS = ['↖', '↗', '↘', '↙'] as const;
const CORNER_NAMES = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'] as const;

export function OverlayAlignmentMode({
  overlay,
  onUpdateCorners,
  onUpdateOpacity,
  onDone,
  onReset,
}: OverlayAlignmentModeProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedCorner, setSelectedCorner] = useState<CornerIndex | null>(null);

  /**
   * Called when user taps on the map while a corner is selected.
   * Updates the corner's geo coordinates.
   */
  const handleMapTap = useCallback(
    (lat: number, lng: number) => {
      if (selectedCorner === null) return;

      const newCorners = [...overlay.corners] as MapOverlay['corners'];
      newCorners[selectedCorner] = [lat, lng];
      onUpdateCorners(newCorners);
      setSelectedCorner(null);
    },
    [selectedCorner, overlay.corners, onUpdateCorners]
  );

  const handleRotate = useCallback(
    (angleDegrees: number) => {
      const angleRad = (angleDegrees * Math.PI) / 180;
      const rotated = rotateCorners(overlay.corners, angleRad);
      onUpdateCorners(rotated);
    },
    [overlay.corners, onUpdateCorners]
  );

  const opacitySteps = [0.25, 0.5, 0.75, 1.0];

  return (
    <>
      {/* Corner markers - absolute positioned at corners */}
      {overlay.corners.map((corner, index) => (
        <View
          key={index}
          style={[
            styles.cornerMarkerContainer,
            // Note: actual positioning is done by the parent map component
            // This component just renders the markers and UI
          ]}
        >
          <Pressable
            onPress={() => setSelectedCorner(index as CornerIndex)}
            style={[
              styles.cornerMarker,
              {
                backgroundColor: selectedCorner === index ? colors.primary : colors.surface,
                borderColor: selectedCorner === index ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.cornerLabel, { color: colors.text.primary }]}>
              {CORNER_LABELS[index]}
            </Text>
          </Pressable>
        </View>
      ))}

      {/* Bottom control panel */}
      <View
        style={[
          styles.controlPanel,
          glassSheet(colors.glass),
          Platform.OS === 'web' && styles.controlPanelWeb,
        ]}
      >
        <View style={styles.instructions}>
          {selectedCorner !== null ? (
            <Text style={[styles.instructionText, { color: colors.primary }]}>
              Tap map to place {CORNER_NAMES[selectedCorner]}
            </Text>
          ) : (
            <Text style={[styles.instructionText, { color: colors.text.muted }]}>
              {t('overlays.dragCorners')}
            </Text>
          )}
        </View>

        {/* Corner selection buttons */}
        <View style={styles.cornerButtons}>
          {CORNER_LABELS.map((label, index) => (
            <Pressable
              key={index}
              onPress={() =>
                setSelectedCorner(selectedCorner === index ? null : (index as CornerIndex))
              }
              style={[
                styles.cornerButton,
                {
                  backgroundColor: selectedCorner === index ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cornerButtonText,
                  { color: selectedCorner === index ? colors.text.inverse : colors.text.primary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rotation controls */}
        <View style={styles.rotationControls}>
          <Text style={[styles.label, { color: colors.text.muted }]}>Rotate:</Text>
          <Pressable
            onPress={() => handleRotate(-15)}
            style={[styles.rotateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text.primary }}>-15°</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRotate(-5)}
            style={[styles.rotateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text.primary }}>-5°</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRotate(5)}
            style={[styles.rotateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text.primary }}>+5°</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRotate(15)}
            style={[styles.rotateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text.primary }}>+15°</Text>
          </Pressable>
        </View>

        {/* Opacity control */}
        <View style={styles.opacityControl}>
          <Text style={[styles.label, { color: colors.text.muted }]}>{t('overlays.opacity')}:</Text>
          <View style={styles.opacityButtons}>
            {opacitySteps.map((step) => (
              <Pressable
                key={step}
                onPress={() => onUpdateOpacity(step)}
                style={[
                  styles.opacityButton,
                  {
                    backgroundColor:
                      Math.abs(overlay.opacity - step) < 0.01 ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      Math.abs(overlay.opacity - step) < 0.01
                        ? colors.text.inverse
                        : colors.text.primary,
                    fontSize: fontSize.sm,
                  }}
                >
                  {Math.round(step * 100)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button title={t('overlays.reset')} variant="secondary" onPress={onReset} />
          <Button title={t('overlays.done')} variant="primary" onPress={onDone} />
        </View>
      </View>
    </>
  );
}

// Export the map tap handler type for parent components
export type { OverlayAlignmentModeProps };

// Export a helper to check if alignment mode should handle a tap
export function useAlignmentModeTapHandler(
  selectedCorner: CornerIndex | null,
  onUpdateCorners: (lat: number, lng: number) => void
) {
  return useCallback(
    (lat: number, lng: number): boolean => {
      if (selectedCorner !== null) {
        onUpdateCorners(lat, lng);
        return true; // consumed the tap
      }
      return false; // let other handlers process
    },
    [selectedCorner, onUpdateCorners]
  );
}

const styles = StyleSheet.create({
  cornerMarkerContainer: {
    position: 'absolute',
    zIndex: 1001,
  },
  cornerMarker: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    zIndex: 1002,
  },
  controlPanelWeb: {
    bottom: 80, // Account for tab bar
  },
  instructions: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  instructionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  cornerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cornerButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  rotationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rotateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  label: {
    fontSize: fontSize.sm,
    marginRight: spacing.sm,
  },
  opacityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  opacityButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  opacityButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
