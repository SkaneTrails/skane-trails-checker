/**
 * Tracking overlay — HUD displayed on the map during active GPS recording.
 *
 * Shows real-time stats (distance, elapsed time, point count) and
 * controls (pause/resume/stop). When stopped, shows save form.
 *
 * On native, pause/resume/stop buttons are hidden because
 * TrackingControls.native.tsx provides FAB buttons that also
 * manage the background GPS task via TrackingService.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSaveRecording } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { reverseGeocode } from '@/lib/reverse-geocode';
import { useTracking } from '@/lib/tracking-context';
import * as TrackingService from '@/lib/tracking-service';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function dateFallback(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TrackingOverlay() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { status, stats, elapsedMs, pause, resume, stop, reset, points } = useTracking();
  const saveRecording = useSaveRecording();
  const [trailName, setTrailName] = useState('');
  const prevStatusRef = useRef(status);

  // Pre-fill trail name via reverse geocoding when entering 'stopped' state
  useEffect(() => {
    const wasStopped = prevStatusRef.current === 'stopped';
    prevStatusRef.current = status;
    if (status !== 'stopped' || wasStopped) return;

    const fallback = t('tracking.defaultNameFallback', { date: dateFallback() });

    if (points.length === 0) {
      setTrailName(fallback);
      return;
    }

    const { lat, lng } = points[0];
    let cancelled = false;

    reverseGeocode(lat, lng)
      .then((location) => {
        if (cancelled) return;
        setTrailName(
          location
            ? t('tracking.defaultName', { location })
            : fallback,
        );
      })
      .catch(() => {
        if (!cancelled) setTrailName(fallback);
      });

    return () => { cancelled = true; };
  }, [status, points, t]);

  if (status === 'idle') return null;

  const handleDiscard = () => {
    Alert.alert(t('tracking.discard'), t('tracking.discardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tracking.discard'),
        style: 'destructive',
        onPress: () => {
          TrackingService.clearBuffer();
          reset();
        },
      },
    ]);
  };

  const handleSave = () => {
    const name = trailName.trim();
    if (!name) return;

    saveRecording.mutate(
      { name, points },
      {
        onSuccess: () => {
          TrackingService.clearBuffer();
          reset();
          setTrailName('');
        },
      },
    );
  };

  const distanceText = stats
    ? t('tracking.distance', { km: stats.distanceKm.toFixed(2) })
    : t('tracking.distance', { km: '0.00' });

  const pointsText = t('tracking.points', { count: String(points.length) });

  return (
    <View
      style={[styles.container, glassCard(colors.glass), shadows.elevated]}
      accessibilityRole="timer"
    >
      {/* Status indicator */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                status === 'tracking'
                  ? '#ef4444'
                  : status === 'paused'
                    ? '#f59e0b'
                    : colors.text.muted,
            },
          ]}
        />
        <Text style={[styles.statusText, { color: colors.text.primary }]}>
          {status === 'tracking'
            ? t('tracking.recording')
            : status === 'paused'
              ? t('tracking.paused')
              : t('tracking.stopped')}
        </Text>
      </View>

      {/* Timer */}
      <Text
        style={[styles.timer, { color: colors.text.primary }]}
        accessibilityLabel={`Elapsed time: ${formatElapsed(elapsedMs)}`}
      >
        {formatElapsed(elapsedMs)}
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: colors.text.secondary }]}>{distanceText}</Text>
        <Text style={[styles.statSeparator, { color: colors.text.muted }]}>·</Text>
        <Text style={[styles.stat, { color: colors.text.secondary }]}>{pointsText}</Text>
        {stats && stats.elevationGain > 0 && (
          <>
            <Text style={[styles.statSeparator, { color: colors.text.muted }]}>·</Text>
            <Text style={[styles.stat, { color: colors.text.secondary }]}>
              {t('tracking.elevationGain', { meters: String(Math.round(stats.elevationGain)) })}
            </Text>
          </>
        )}
      </View>

      {/* Controls — hidden on native where TrackingControls FAB handles them */}
      {status === 'tracking' && Platform.OS === 'web' && (
        <View style={styles.controls}>
          <Pressable
            onPress={pause}
            style={[styles.controlButton, { backgroundColor: colors.glass.activeHighlight }]}
            accessibilityLabel={t('tracking.pauseTracking')}
          >
            <Text style={[styles.controlText, { color: colors.text.primary }]}>
              {t('tracking.pauseTracking')}
            </Text>
          </Pressable>
          <Pressable
            onPress={stop}
            style={[styles.controlButton, { backgroundColor: '#ef4444' }]}
            accessibilityLabel={t('tracking.stopTracking')}
          >
            <Text style={[styles.controlText, { color: '#fff' }]}>
              {t('tracking.stopTracking')}
            </Text>
          </Pressable>
        </View>
      )}

      {status === 'paused' && Platform.OS === 'web' && (
        <View style={styles.controls}>
          <Pressable
            onPress={resume}
            style={[styles.controlButton, { backgroundColor: colors.primary }]}
            accessibilityLabel={t('tracking.resumeTracking')}
          >
            <Text style={[styles.controlText, { color: '#fff' }]}>
              {t('tracking.resumeTracking')}
            </Text>
          </Pressable>
          <Pressable
            onPress={stop}
            style={[styles.controlButton, { backgroundColor: '#ef4444' }]}
            accessibilityLabel={t('tracking.stopTracking')}
          >
            <Text style={[styles.controlText, { color: '#fff' }]}>
              {t('tracking.stopTracking')}
            </Text>
          </Pressable>
        </View>
      )}

      {status === 'stopped' && (
        <View style={styles.saveSection}>
          <TextInput
            value={trailName}
            onChangeText={setTrailName}
            placeholder={t('tracking.trailNamePlaceholder')}
            placeholderTextColor={colors.text.muted}
            style={[
              styles.nameInput,
              {
                color: colors.text.primary,
                borderColor: colors.glass.border,
                backgroundColor: colors.glass.background,
              },
            ]}
            maxLength={200}
            accessibilityLabel={t('tracking.trailName')}
          />
          <View style={styles.controls}>
            <Pressable
              onPress={handleDiscard}
              style={[styles.controlButton, { backgroundColor: colors.glass.activeHighlight }]}
              accessibilityLabel={t('tracking.discard')}
            >
              <Text style={[styles.controlText, { color: colors.text.primary }]}>
                {t('tracking.discard')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!trailName.trim() || saveRecording.isPending}
              style={[
                styles.controlButton,
                {
                  backgroundColor: colors.primary,
                  opacity: !trailName.trim() || saveRecording.isPending ? 0.5 : 1,
                },
              ]}
              accessibilityLabel={t('tracking.saveTrail')}
            >
              <Text style={[styles.controlText, { color: '#fff' }]}>
                {saveRecording.isPending ? t('tracking.saving') : t('tracking.saveTrail')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 950,
    padding: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  timer: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums' as const],
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stat: {
    fontSize: fontSize.sm,
  },
  statSeparator: {
    fontSize: fontSize.sm,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  controlText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  saveSection: {
    gap: spacing.md,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
  },
});
