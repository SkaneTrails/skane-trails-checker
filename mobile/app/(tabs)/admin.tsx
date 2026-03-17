/**
 * Admin screen — group and superuser management for superusers.
 * Only visible to users with 'superuser' role.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button, ContentCard, FormField } from '@/components';
import { ScreenLayout } from '@/components/ScreenLayout';
import { TabIcon } from '@/components/TabIcon';
import {
  useAddSuperuser,
  useCreateHikeGroup,
  useCurrentUser,
  useHikeGroups,
  useRemoveSuperuser,
  useSuperusers,
} from '@/lib/hooks/use-hike-groups';
import { useTranslation } from '@/lib/i18n';
import { borderRadius, fontSize, fontWeight, spacing, useTheme } from '@/lib/theme';

export default function AdminScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: groups, isLoading: groupsLoading } = useHikeGroups();
  const { data: superusers, isLoading: superusersLoading } = useSuperusers();
  const createGroupMutation = useCreateHikeGroup();
  const addSuperuserMutation = useAddSuperuser();
  const removeSuperuserMutation = useRemoveSuperuser();

  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newSuEmail, setNewSuEmail] = useState('');
  const [showSuForm, setShowSuForm] = useState(false);

  if (userLoading) {
    return (
      <ScreenLayout title={t('admin.title')}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (!currentUser || currentUser.role !== 'superuser') {
    return (
      <ScreenLayout title={t('admin.title')}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <TabIcon name="shield" color={colors.text.muted} size={48} />
          <Text style={{ color: colors.text.primary, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: spacing.md }}>
            {t('admin.accessRequired')}
          </Text>
          <Text style={{ color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' }}>
            {t('admin.accessRequiredMessage')}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    try {
      await createGroupMutation.mutateAsync({ name: trimmed });
      setNewGroupName('');
      setShowGroupForm(false);
    } catch {
      Alert.alert(t('common.error') ?? 'Error', t('admin.failedToCreateGroup'));
    }
  };

  const handleAddSuperuser = async () => {
    const trimmed = newSuEmail.trim().toLowerCase();
    if (!trimmed) return;
    try {
      await addSuperuserMutation.mutateAsync(trimmed);
      setNewSuEmail('');
      setShowSuForm(false);
    } catch {
      Alert.alert(t('common.error') ?? 'Error', t('admin.failedToAddSuperuser'));
    }
  };

  const handleRemoveSuperuser = (email: string) => {
    Alert.alert(
      t('admin.removeSuperuser'),
      t('admin.removeSuperuserConfirm', { email }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSuperuserMutation.mutateAsync(email);
            } catch {
              Alert.alert(t('common.error') ?? 'Error', t('admin.failedToRemoveSuperuser'));
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenLayout title={t('admin.title')}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current user info */}
        <ContentCard style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
            {t('admin.loggedInAs')}
          </Text>
          <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: colors.text.primary }}>
            {currentUser.email}
          </Text>
          <View style={{
            backgroundColor: colors.primary + '20',
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: borderRadius.full,
            alignSelf: 'flex-start',
            marginTop: spacing.xs,
          }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.medium }}>
              {t('admin.role.superuser')}
            </Text>
          </View>
        </ContentCard>

        {/* Groups section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            {t('admin.groups')}
          </Text>
          <Button
            title={t('admin.newGroup')}
            onPress={() => setShowGroupForm(!showGroupForm)}
            variant="secondary"
            pill
          />
        </View>

        {showGroupForm && (
          <ContentCard style={{ marginBottom: spacing.md }}>
            <FormField
              label={t('settings.groupName')}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder={t('settings.groupName')}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title={t('common.cancel')}
                onPress={() => { setShowGroupForm(false); setNewGroupName(''); }}
                variant="secondary"
              />
              <Button
                title={t('settings.createGroup')}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || createGroupMutation.isPending}
              />
            </View>
          </ContentCard>
        )}

        {groupsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : !groups?.length ? (
          <ContentCard style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {t('admin.noGroups')}
            </Text>
          </ContentCard>
        ) : (
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            {groups.map((group) => (
              <Pressable
                key={group.group_id}
                onPress={() => router.push(`/group-settings?id=${group.group_id}`)}
              >
                <ContentCard>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text.primary }}>
                        {group.name}
                      </Text>
                      <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 }}>
                        {t('settings.members')}: {group.member_count}
                      </Text>
                    </View>
                    <TabIcon name="chevron-forward" color={colors.text.muted} size={20} />
                  </View>
                </ContentCard>
              </Pressable>
            ))}
          </View>
        )}

        {/* Superusers section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            {t('admin.superusers')}
          </Text>
          <Button
            title={t('admin.addSuperuser')}
            onPress={() => setShowSuForm(!showSuForm)}
            variant="secondary"
            pill
          />
        </View>

        {showSuForm && (
          <ContentCard style={{ marginBottom: spacing.md }}>
            <FormField
              label={t('admin.emailPlaceholder')}
              value={newSuEmail}
              onChangeText={setNewSuEmail}
              placeholder={t('admin.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title={t('common.cancel')}
                onPress={() => { setShowSuForm(false); setNewSuEmail(''); }}
                variant="secondary"
              />
              <Button
                title={t('admin.addSuperuser')}
                onPress={handleAddSuperuser}
                disabled={!newSuEmail.trim() || addSuperuserMutation.isPending}
              />
            </View>
          </ContentCard>
        )}

        {superusersLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : !superusers?.length ? (
          <ContentCard>
            <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {t('admin.noSuperusers')}
            </Text>
          </ContentCard>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {superusers.map((su) => (
              <ContentCard key={su.email}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: fontSize.md, color: colors.text.primary, flex: 1 }}>
                    {su.email}
                  </Text>
                  {su.email !== currentUser.email && (
                    <Button
                      title={t('admin.removeSuperuser')}
                      onPress={() => handleRemoveSuperuser(su.email)}
                      variant="danger"
                      pill
                    />
                  )}
                </View>
              </ContentCard>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
