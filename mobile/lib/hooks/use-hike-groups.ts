/**
 * React Query hooks for hike group operations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hikeGroupsApi } from '@/lib/api';
import type { AddMemberRequest, HikeGroupCreate } from '@/lib/types';

export const hikeGroupKeys = {
  all: ['hike-groups'] as const,
  list: ['hike-groups', 'list'] as const,
  detail: (id: string) => ['hike-groups', id] as const,
};

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
    },
  });
}
