/**
 * Hamburger menu overlay for map screen actions.
 *
 * Primary navigation replacing the old tab bar. Provides access to
 * all app sections: trails, foraging, places, upload, settings, admin.
 * Renders as a glass-styled dropdown anchored to the top-right.
 */

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';
import { TabIcon } from './TabIcon';

type IconName = 'compass' | 'leaf' | 'pin' | 'play' | 'upload' | 'settings' | 'shield' | 'image';

interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

interface HamburgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onTrails: () => void;
  onForaging: () => void;
  onPlaces: () => void;
  onUpload: () => void;
  onOverlays: () => void;
  onSettings: () => void;
  onAdmin: () => void;
  onStartTracking: () => void;
  showAdmin?: boolean;
}

export function HamburgerMenu({
  isOpen,
  onToggle,
  onTrails,
  onForaging,
  onPlaces,
  onUpload,
  onOverlays,
  onSettings,
  onAdmin,
  onStartTracking,
  showAdmin = false,
}: HamburgerMenuProps) {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();

  const isWeb = Platform.OS === 'web';

  const items: MenuItem[] = [
    {
      key: 'trails',
      label: t('tabs.trails'),
      icon: 'compass',
      onPress: onTrails,
    },
    {
      key: 'foraging',
      label: t('tabs.foraging'),
      icon: 'leaf',
      onPress: onForaging,
    },
    {
      key: 'places',
      label: t('tabs.places'),
      icon: 'pin',
      onPress: onPlaces,
    },
    {
      key: 'upload',
      label: t('trails.uploadGpx'),
      icon: 'upload',
      onPress: onUpload,
    },
    {
      key: 'overlays',
      label: t('overlays.title'),
      icon: 'image',
      onPress: onOverlays,
    },
    ...(!isWeb
      ? [
          {
            key: 'tracking',
            label: t('tracking.startRecording'),
            icon: 'play' as IconName,
            onPress: onStartTracking,
          },
        ]
      : []),
    {
      key: 'settings',
      label: t('settings.title'),
      icon: 'settings',
      onPress: onSettings,
    },
    ...(showAdmin
      ? [
          {
            key: 'admin',
            label: t('tabs.admin'),
            icon: 'shield' as IconName,
            onPress: onAdmin,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Menu button */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={t('map.menu')}
        accessibilityState={{ expanded: isOpen }}
        style={[
          styles.menuButton,
          {
            backgroundColor: colors.glass.background,
            borderWidth: 1,
            borderColor: colors.glass.borderSubtle,
          },
          shadows.subtle,
        ]}
      >
        <TabIcon name="menu" color={colors.text.secondary} size={20} strokeWidth={1.5} />
      </Pressable>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onToggle}
            accessibilityLabel={t('map.closeMenu')}
          />

          <View
            style={[
              styles.dropdown,
              glassCard(colors.glass),
              shadows.elevated,
            ]}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  onToggle();
                  item.onPress();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                style={[
                  styles.menuItem,
                  index < items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.glass.border,
                  },
                ]}
              >
                <TabIcon
                  name={item.icon}
                  color={colors.text.secondary}
                  size={18}
                  strokeWidth={1.5}
                />
                <View style={styles.menuItemText}>
                  <Text
                    style={[
                      styles.menuLabel,
                      {
                        color: colors.text.primary,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    padding: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  dropdown: {
    position: 'absolute',
    top: spacing.lg + 44,
    right: spacing.lg,
    zIndex: 1001,
    minWidth: 220,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemText: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
