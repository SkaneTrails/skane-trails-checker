import { Alert, Linking } from 'react-native';

// Mock expo-location
vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(),
  requestBackgroundPermissionsAsync: vi.fn(),
}));

vi.mock('react-native', async () => {
  return {
    Alert: { alert: vi.fn() },
    Linking: { openSettings: vi.fn() },
    Platform: { OS: 'android' },
  };
});

import * as Location from 'expo-location';
import {
  requestForegroundPermission,
  requestBackgroundPermission,
  requestTrackingPermissions,
} from '@/lib/location-permissions';

describe('location-permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestForegroundPermission', () => {
    it('returns granted when permission is granted', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'granted' as Location.PermissionStatus,
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });

      const result = await requestForegroundPermission();
      expect(result).toBe('granted');
    });

    it('returns denied when permission is denied but can ask again', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: true,
        granted: false,
        expires: 'never',
      });

      const result = await requestForegroundPermission();
      expect(result).toBe('denied');
    });

    it('returns blocked when permission is denied and cannot ask again', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      const result = await requestForegroundPermission();
      expect(result).toBe('blocked');
    });
  });

  describe('requestBackgroundPermission', () => {
    it('returns granted when permission is granted', async () => {
      vi.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
        status: 'granted' as Location.PermissionStatus,
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });

      const result = await requestBackgroundPermission();
      expect(result).toBe('granted');
    });

    it('returns blocked when denied and cannot ask again', async () => {
      vi.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      const result = await requestBackgroundPermission();
      expect(result).toBe('blocked');
    });
  });

  describe('requestTrackingPermissions', () => {
    const t = (key: string) => key;

    it('returns true when both permissions are granted', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'granted' as Location.PermissionStatus,
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });
      vi.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
        status: 'granted' as Location.PermissionStatus,
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });

      const result = await requestTrackingPermissions(t);
      expect(result).toBe(true);
    });

    it('returns false and shows alert when foreground is blocked', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      const result = await requestTrackingPermissions(t);
      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'permissions.locationRequired',
        'permissions.openSettings',
        expect.arrayContaining([
          expect.objectContaining({ text: 'common.cancel' }),
          expect.objectContaining({ text: 'permissions.settings' }),
        ]),
      );
    });

    it('returns false when foreground is denied (not blocked)', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: true,
        granted: false,
        expires: 'never',
      });

      const result = await requestTrackingPermissions(t);
      expect(result).toBe(false);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('returns false and shows alert when background is blocked', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'granted' as Location.PermissionStatus,
        canAskAgain: true,
        granted: true,
        expires: 'never',
      });
      vi.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      const result = await requestTrackingPermissions(t);
      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'permissions.backgroundRequired',
        'permissions.backgroundExplanation',
        expect.arrayContaining([
          expect.objectContaining({ text: 'permissions.settings' }),
        ]),
      );
    });

    it('opens settings when user taps settings button on blocked foreground', async () => {
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: 'denied' as Location.PermissionStatus,
        canAskAgain: false,
        granted: false,
        expires: 'never',
      });

      await requestTrackingPermissions(t);

      // Find the settings button handler in the Alert.alert call
      const alertCall = vi.mocked(Alert.alert).mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;
      const settingsButton = buttons.find((b) => b.text === 'permissions.settings');
      settingsButton?.onPress?.();

      expect(Linking.openSettings).toHaveBeenCalled();
    });
  });
});
