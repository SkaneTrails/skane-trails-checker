/**
 * Hamburger menu overlay for map screen actions.
 *
 * Provides quick access to settings and GPS tracking (Android only).
 * Renders as a glass-styled dropdown anchored to the top-right.
 */

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { glassCard } from '@/lib/theme/styles';
import { TabIcon } from './TabIcon';

interface MenuItem {
  key: string;
  label: string;
  icon: 'play' | 'settings';
  onPress: () => void;
  disabled?: boolean;
  subtitle?: string;
}

interface HamburgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onSettings: () => void;
  onStartTracking: () => void;
  showTrackingItem?: boolean;
}

export function HamburgerMenu({ isOpen, onToggle, onSettings, onStartTracking, showTrackingItem = true }: HamburgerMenuProps) {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();

  const isWeb = Platform.OS === 'web';

  const items: MenuItem[] = [
    ...(showTrackingItem
      ? [
          {
            key: 'tracking',
            label: t('tracking.startTracking'),
            icon: 'play' as const,
            onPress: onStartTracking,
            disabled: isWeb,
            subtitle: isWeb ? t('tracking.webNotSupported') : undefined,
          },
        ]
      : []),
    {
      key: 'settings',
      label: t('settings.title'),
      icon: 'settings' as const,
      onPress: onSettings,
    },
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
                  if (!item.disabled) {
                    onToggle();
                    item.onPress();
                  }
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: item.disabled }}
                style={[
                  styles.menuItem,
                  index < items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.glass.border,
                  },
                  item.disabled && styles.menuItemDisabled,
                ]}
              >
                <TabIcon
                  name={item.icon}
                  color={item.disabled ? colors.text.muted : colors.text.secondary}
                  size={18}
                  strokeWidth={1.5}
                />
                <View style={styles.menuItemText}>
                  <Text
                    style={[
                      styles.menuLabel,
                      {
                        color: item.disabled ? colors.text.muted : colors.text.primary,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.subtitle && (
                    <Text style={[styles.menuSubtitle, { color: colors.text.muted }]}>
                      {item.subtitle}
                    </Text>
                  )}
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
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuItemText: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  menuSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
