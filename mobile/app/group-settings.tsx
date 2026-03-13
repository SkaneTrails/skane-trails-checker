/**
 * Group settings screen — manage group name and members.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
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
import {
  useAddMember,
  useHikeGroup,
  useRemoveMember,
  useUpdateHikeGroup,
} from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export default function GroupSettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: group, isLoading } = useHikeGroup(id ?? '', { enabled: !!id });
  const updateMutation = useUpdateHikeGroup();
  const addMemberMutation = useAddMember();
  const removeMemberMutation = useRemoveMember();

  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (isLoading || !group) {
    return (
      <ScreenLayout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  const isOwner = group.members.some(
    (m) => m.role === 'owner',
  );

  const handleSaveName = async () => {
    const trimmed = groupName.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      return;
    }
    await updateMutation.mutateAsync({ groupId: group.group_id, name: trimmed });
    setEditingName(false);
  };

  const handleAddMember = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    await addMemberMutation.mutateAsync({
      groupId: group.group_id,
      data: { email: trimmed },
    });
    setNewEmail('');
  };

  const handleRemoveMember = (memberUid: string, memberEmail: string) => {
    Alert.alert(
      t('settings.removeMember'),
      memberEmail,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.removeMember'),
          style: 'destructive',
          onPress: () =>
            removeMemberMutation.mutate({
              groupId: group.group_id,
              memberUid,
            }),
        },
      ],
    );
  };

  return (
    <ScreenLayout>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Group Name */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.groupName')}
        </Text>
        <ContentCard>
          {editingName ? (
            <View>
              <FormField
                label={t('settings.groupName')}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
                autoFocus
              />
              <View style={styles.formActions}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  onPress={() => setEditingName(false)}
                />
                <Button
                  title={t('common.save')}
                  onPress={handleSaveName}
                  disabled={updateMutation.isPending}
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setGroupName(group.name);
                setEditingName(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('trail.rename')}
            >
              <Text style={[styles.groupNameText, { color: colors.text.primary }]}>
                {group.name}
              </Text>
              <Text style={[styles.tapToEdit, { color: colors.text.muted }]}>
                {t('trail.rename')}
              </Text>
            </Pressable>
          )}
        </ContentCard>

        {/* Members */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('settings.members')}
        </Text>
        <ContentCard>
          {group.members.map((member) => (
            <View key={member.uid || member.email} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberEmail, { color: colors.text.primary }]}>
                  {member.email}
                </Text>
                {member.name && (
                  <Text style={[styles.memberName, { color: colors.text.secondary }]}>
                    {member.name}
                  </Text>
                )}
              </View>
              <View style={styles.memberActions}>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor:
                        member.role === 'owner'
                          ? colors.status.exploredBg
                          : colors.chip.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color:
                          member.role === 'owner'
                            ? colors.status.exploredText
                            : colors.chip.text,
                      },
                    ]}
                  >
                    {member.role === 'owner'
                      ? t('settings.owner')
                      : t('settings.member')}
                  </Text>
                </View>
                {member.role !== 'owner' && (
                  <Pressable
                    onPress={() => handleRemoveMember(member.uid, member.email)}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.removeMember')}
                  >
                    <Text style={{ color: colors.error, fontSize: fontSize.sm }}>
                      {t('settings.removeMember')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {/* Add member */}
          <View style={styles.addMemberRow}>
            <View style={styles.addMemberInput}>
              <FormField
                label={t('settings.addMember')}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder={t('settings.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Button
              title={t('settings.addMember')}
              onPress={handleAddMember}
              disabled={!newEmail.trim() || addMemberMutation.isPending}
            />
          </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  groupNameText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  tapToEdit: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: fontSize.md,
  },
  memberName: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  addMemberRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  addMemberInput: {
    flex: 1,
  },
});
