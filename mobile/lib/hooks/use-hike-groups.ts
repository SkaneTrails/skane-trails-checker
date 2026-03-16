/**
 * React Query hooks for hike group operations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hikeGroupsApi } from '@/lib/api';
import type { AddMemberRequest, HikeGroupCreate } from '@/lib/types';

export const currentUserKeys = {
  all: ['admin', 'currentUser'] as const,
};

export const hikeGroupKeys = {
  all: ['hike-groups'] as const,
  list: ['hike-groups', 'list'] as const,
  detail: (id: string) => ['hike-groups', id] as const,
};

export const memberKeys = {
  all: ['group-members'] as const,
  list: (groupId: string) => ['group-members', groupId] as const,
};

export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: currentUserKeys.all,
    queryFn: () => hikeGroupsApi.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: options?.enabled,
  });
}

export function useHikeGroups() {
  return useQuery({
    queryKey: hikeGroupKeys.list,
    queryFn: () => hikeGroupsApi.getGroups(),
  });
}

export function useHikeGroup(groupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: hikeGroupKeys.detail(groupId),
    queryFn: () => hikeGroupsApi.getGroup(groupId),
    enabled: options?.enabled,
  });
}

export function useGroupMembers(groupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memberKeys.list(groupId),
    queryFn: () => hikeGroupsApi.getMembers(groupId),
    enabled: (options?.enabled ?? true) && Boolean(groupId),
  });
}

export function useCreateHikeGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: HikeGroupCreate) => hikeGroupsApi.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hikeGroupKeys.all });
    },
  });
}

export function useUpdateHikeGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      hikeGroupsApi.updateGroup(groupId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hikeGroupKeys.all });
    },
  });
}

export function useDeleteHikeGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => hikeGroupsApi.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hikeGroupKeys.all });
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: AddMemberRequest }) =>
      hikeGroupsApi.addMember(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hikeGroupKeys.all });
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, memberEmail }: { groupId: string; memberEmail: string }) =>
      hikeGroupsApi.removeMember(groupId, memberEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hikeGroupKeys.all });
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}
