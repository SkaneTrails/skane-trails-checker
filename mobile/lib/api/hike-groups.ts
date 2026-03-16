/**
 * Hike group and admin API client.
 */

import type { AddMemberRequest, CurrentUser, HikeGroup, HikeGroupCreate, HikeGroupMember, UpdateMemberRequest } from '../types';
import { apiRequest } from './client';

export const hikeGroupsApi = {
  getCurrentUser(): Promise<CurrentUser> {
    return apiRequest('/api/v1/admin/me');
  },

  getGroups(): Promise<HikeGroup[]> {
    return apiRequest('/api/v1/admin/groups');
  },

  getGroup(groupId: string): Promise<HikeGroup> {
    return apiRequest(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`);
  },

  createGroup(data: HikeGroupCreate): Promise<HikeGroup> {
    return apiRequest('/api/v1/admin/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateGroup(groupId: string, data: { name: string }): Promise<HikeGroup> {
    return apiRequest(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteGroup(groupId: string): Promise<void> {
    return apiRequest(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    });
  },

  getMembers(groupId: string): Promise<HikeGroupMember[]> {
    return apiRequest(`/api/v1/admin/groups/${encodeURIComponent(groupId)}/members`);
  },

  addMember(groupId: string, data: AddMemberRequest): Promise<HikeGroupMember> {
    return apiRequest(`/api/v1/admin/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  removeMember(groupId: string, memberEmail: string): Promise<void> {
    return apiRequest(
      `/api/v1/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberEmail)}`,
      {
        method: 'DELETE',
      },
    );
  },

  updateMemberRole(groupId: string, memberEmail: string, data: UpdateMemberRequest): Promise<HikeGroupMember> {
    return apiRequest(
      `/api/v1/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberEmail)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
  },
};
