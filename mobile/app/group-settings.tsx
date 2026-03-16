/**
 * Group settings screen — manage group name and members.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, ContentCard, FormField } from '@/components';
import { TabIcon } from '@/components/TabIcon';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  useAddMember,
  useCurrentUser,
  useGroupMembers,
  useHikeGroup,
  useRemoveMember,
  useUpdateHikeGroup,
} from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, sheet, spacing, useTheme } from '@/lib/theme';
import { glassSheet } from '@/lib/theme/styles';

export default function GroupSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: group, isLoading } = useHikeGroup(id ?? '', { enabled: !!id });
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(id ?? '', { enabled: !!id });
  const { data: currentUser } = useCurrentUser();
  const updateMutation = useUpdateHikeGroup();
  const addMemberMutation = useAddMember();
  const removeMemberMutation = useRemoveMember();

  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  if (isLoading || membersLoading || !group) {
    return (
      <View style={styles.backdrop}>
        <View style={styles.cardWrap}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </View>
    );
  }

  const isSuperuser = currentUser?.role === 'superuser';
  const isAdmin = isSuperuser || members.some((m) => m.role === 'admin' && m.email === user?.email);

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

  const handleRemoveMember = (memberEmail: string) => {
    Alert.alert(t('settings.removeMember'), memberEmail, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.removeMember'),
        style: 'destructive',
        onPress: () =>
          removeMemberMutation.mutate({
            groupId: group.group_id,
            memberEmail,
          }),
      },
    ]);
  };

  const glass = glassSheet(colors.glass);

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View
        style={[
          styles.cardWrap,
          glass,
          shadows.elevated,
          Platform.OS === 'web' && {
            boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
          },
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.text.muted, opacity: 0.3 }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {t('settings.groupSettings')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeButton}
            accessibilityLabel={t('common.cancel')}
          >
            <TabIcon name="close" color={colors.text.muted} size={20} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          {members.map((member) => (
            <View key={member.email} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberEmail, { color: colors.text.primary }]}>
                  {member.email}
                </Text>
                {!!member.display_name && (
                  <Text style={[styles.memberName, { color: colors.text.secondary }]}>
                    {member.display_name}
                  </Text>
                )}
              </View>
              <View style={styles.memberActions}>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor:
                        member.role === 'admin' ? colors.status.exploredBg : colors.chip.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color:
                          member.role === 'admin' ? colors.status.exploredText : colors.chip.text,
                      },
                    ]}
                  >
                    {member.role === 'admin' ? t('settings.admin') : t('settings.member')}
                  </Text>
                </View>
                {isAdmin && member.role !== 'admin' && (
                  <Pressable
                    onPress={() => handleRemoveMember(member.email)}
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

          {/* Add member (admin only) */}
          {isAdmin && (
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
          )}
        </ContentCard>
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cardWrap: {
    maxHeight: '85%',
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: sheet.handleWidth,
    height: sheet.handleHeight,
    borderRadius: borderRadius.full,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
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
