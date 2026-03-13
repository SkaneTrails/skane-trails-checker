/**
 * Settings screen — hike group, language, and theme management.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, ContentCard, FormField, ScreenLayout } from '@/components';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  useCreateHikeGroup,
  useDeleteHikeGroup,
  useHikeGroups,
} from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { LANGUAGES, useSettings } from '@/lib/settings-context';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';
import { themes } from '@/lib/theme/themes';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { language, setLanguage, themeId } = useSettings();
  const { signOut } = useAuth();
  const router = useRouter();

  const { data: groups, isLoading: groupsLoading } = useHikeGroups();
  const createGroupMutation = useCreateHikeGroup();
  const deleteGroupMutation = useDeleteHikeGroup();

  const [newGroupName, setNewGroupName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    await createGroupMutation.mutateAsync({ name: trimmed });
    setNewGroupName('');
    setShowCreateForm(false);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    Alert.alert(
      t('common.delete'),
      t('settings.deleteGroupConfirm', { name: groupName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteGroupMutation.mutate(groupId),
        },
      ],
    );
  };

  return (
    <ScreenLayout>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hike Group Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.hikeGroup')}
        </Text>
        <ContentCard>
          {groupsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : groups && groups.length > 0 ? (
            groups.map((group) => (
              <View key={group.group_id} style={styles.groupRow}>
                <Pressable
                  style={styles.groupInfo}
                  onPress={() => router.push(`/group-settings?id=${group.group_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={group.name}
                >
                  <Text style={[styles.groupName, { color: colors.text.primary }]}>
                    {group.name}
                  </Text>
                  <Text style={[styles.groupMeta, { color: colors.text.secondary }]}>
                    {group.members.length} {t('settings.members').toLowerCase()}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteGroup(group.group_id, group.name)}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.deleteGroup')}
                >
                  <Text style={{ color: colors.error, fontSize: fontSize.sm }}>
                    {t('settings.deleteGroup')}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : showCreateForm ? (
            <View>
              <FormField
                label={t('settings.groupName')}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder={t('settings.groupName')}
                maxLength={50}
                autoFocus
              />
              <View style={styles.formActions}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  onPress={() => {
                    setShowCreateForm(false);
                    setNewGroupName('');
                  }}
                />
                <Button
                  title={t('settings.createGroup')}
                  onPress={handleCreateGroup}
                  disabled={!newGroupName.trim() || createGroupMutation.isPending}
                />
              </View>
            </View>
          ) : (
            <View style={styles.emptyGroup}>
              <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                {t('settings.noGroup')}
              </Text>
              <Button
                title={t('settings.createGroup')}
                onPress={() => setShowCreateForm(true)}
              />
            </View>
          )}
        </ContentCard>

        {/* Language Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.language')}
        </Text>
        <ContentCard>
          <View style={styles.chipRow}>
            {LANGUAGES.map((lang) => (
              <Chip
                key={lang.code}
                label={`${lang.flag} ${lang.label}`}
                selected={language === lang.code}
                onPress={() => setLanguage(lang.code)}
              />
            ))}
          </View>
        </ContentCard>

        {/* Theme Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.theme')}
        </Text>
        <ContentCard>
          <View style={styles.chipRow}>
            {Object.entries(themes).map(([id, theme]) => (
              <Chip
                key={id}
                label={theme.name}
                selected={themeId === id}
                onPress={() => {}}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.text.muted }]}>
            {t('settings.onlyTheme')}
          </Text>
        </ContentCard>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.account')}
        </Text>
        <ContentCard>
          <Button
            title={t('settings.signOut')}
            variant="secondary"
            onPress={signOut}
          />
        </ContentCard>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  groupMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  emptyGroup: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
});
