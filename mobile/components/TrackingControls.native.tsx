/**
 * Native tracking controls — FAB buttons for GPS recording.
 *
 * Currently targets Android only (iOS is not supported). Uses .native.tsx
 * extension since there is no iOS-specific variant; if iOS support is added
 * later, platform guards or .android.tsx can be introduced.
 *
 * Bridges expo-location background tracking with the shared TrackingContext.
 * When idle, shows a "Start Recording" FAB. Once tracking starts, the
 * TrackingOverlay (shared component) handles pause/stop/save UI.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requestTrackingPermissions } from '@/lib/location-permissions';
import { useTranslation } from '@/lib/i18n';
import { useTracking } from '@/lib/tracking-context';
import * as TrackingService from '@/lib/tracking-service';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export function TrackingControls() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { status, start, pause, resume, stop, addPoint } = useTracking();

  const handleStart = useCallback(async () => {
    const granted = await requestTrackingPermissions(t);
    if (!granted) return;

    try {
      await TrackingService.startTracking(addPoint);
      start();
    } catch {
      // startLocationUpdatesAsync failed — don't transition to tracking state
    }
  }, [t, start, addPoint]);

  const handlePause = useCallback(async () => {
    try {
      await TrackingService.pauseTracking();
      pause();
    } catch {
      // GPS stop failed — don't change UI state
    }
  }, [pause]);

  const handleResume = useCallback(async () => {
    try {
      await TrackingService.resumeTracking(addPoint);
      resume();
    } catch {
      // GPS resume failed — don't change UI state
    }
  }, [resume, addPoint]);

  const handleStop = useCallback(async () => {
    try {
      await TrackingService.pauseTracking();
      stop();
    } catch {
      // GPS stop failed — don't change UI state
    }
  }, [stop]);

  if (status === 'idle') {
    return (
      <View style={styles.fabContainer}>
        <Pressable
          onPress={handleStart}
          style={[styles.fab, { backgroundColor: colors.primary }, shadows.elevated]}
          accessibilityRole="button"
          accessibilityLabel={t('tracking.startTracking')}
        >
          <Text style={styles.fabText}>{t('tracking.startRecording')}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'tracking') {
    return (
      <View style={styles.fabContainer}>
        <Pressable
          onPress={handlePause}
          style={[styles.fabSmall, { backgroundColor: '#f59e0b' }, shadows.elevated]}
          accessibilityRole="button"
          accessibilityLabel={t('tracking.pauseTracking')}
        >
          <Text style={styles.fabSmallText}>{t('tracking.pauseTracking')}</Text>
        </Pressable>
        <Pressable
          onPress={handleStop}
          style={[styles.fabSmall, { backgroundColor: '#ef4444' }, shadows.elevated]}
          accessibilityRole="button"
          accessibilityLabel={t('tracking.stopTracking')}
        >
          <Text style={styles.fabSmallText}>{t('tracking.stopTracking')}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'paused') {
    return (
      <View style={styles.fabContainer}>
        <Pressable
          onPress={handleResume}
          style={[styles.fabSmall, { backgroundColor: colors.primary }, shadows.elevated]}
          accessibilityRole="button"
          accessibilityLabel={t('tracking.resumeTracking')}
        >
          <Text style={styles.fabSmallText}>{t('tracking.resumeTracking')}</Text>
        </Pressable>
        <Pressable
          onPress={handleStop}
          style={[styles.fabSmall, { backgroundColor: '#ef4444' }, shadows.elevated]}
          accessibilityRole="button"
          accessibilityLabel={t('tracking.stopTracking')}
        >
          <Text style={styles.fabSmallText}>{t('tracking.stopTracking')}</Text>
        </Pressable>
      </View>
    );
  }

  // 'stopped' state is handled by TrackingOverlay (save form)
  return null;
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: spacing.xl * 2,
    right: spacing.lg,
    zIndex: 900,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fab: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  fabSmall: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSmallText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
