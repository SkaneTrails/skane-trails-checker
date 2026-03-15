/**
 * Location permission helpers for Android GPS tracking.
 *
 * Requests foreground and background location permissions in the correct
 * order (foreground first, then background) with user-friendly prompts.
 */

import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

/**
 * Request foreground location permission.
 * Returns 'granted', 'denied', or 'blocked' (user selected "don't ask again").
 */
export async function requestForegroundPermission(): Promise<PermissionResult> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

  if (status === 'granted') return 'granted';
  return canAskAgain ? 'denied' : 'blocked';
}

/**
 * Request background location permission (requires foreground granted first).
 * On Android 10+, this shows a separate system dialog.
 */
export async function requestBackgroundPermission(): Promise<PermissionResult> {
  const { status, canAskAgain } = await Location.requestBackgroundPermissionsAsync();

  if (status === 'granted') return 'granted';
  return canAskAgain ? 'denied' : 'blocked';
}

/**
 * Request both foreground and background permissions in sequence.
 * Shows an explanation alert if background is denied.
 */
export async function requestTrackingPermissions(t: (key: string) => string): Promise<boolean> {
  const foreground = await requestForegroundPermission();

  if (foreground === 'blocked') {
    Alert.alert(
      t('permissions.locationRequired'),
      t('permissions.openSettings'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('permissions.settings'), onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }

  if (foreground !== 'granted') return false;

  const background = await requestBackgroundPermission();

  if (background === 'blocked') {
    Alert.alert(
      t('permissions.backgroundRequired'),
      t('permissions.backgroundExplanation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('permissions.settings'), onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }

  return background === 'granted';
}
