/**
 * Hike group API client.
 */

import { apiRequest } from './client';
import type { AddMemberRequest, HikeGroup, HikeGroupCreate } from '../types';

export const hikeGroupsApi = {
  getGroups(): Promise<HikeGroup[]> {
    return apiRequest('/api/v1/hike-groups');
  },

  getGroup(groupId: string): Promise<HikeGroup> {
    return apiRequest(`/api/v1/hike-groups/${encodeURIComponent(groupId)}`);
  },

  createGroup(data: HikeGroupCreate): Promise<HikeGroup> {
    return apiRequest('/api/v1/hike-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateGroup(groupId: string, data: { name: string }): Promise<HikeGroup> {
    return apiRequest(`/api/v1/hike-groups/${encodeURIComponent(groupId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteGroup(groupId: string): Promise<void> {
    return apiRequest(`/api/v1/hike-groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    });
  },

  addMember(groupId: string, data: AddMemberRequest): Promise<HikeGroup> {
    return apiRequest(
      `/api/v1/hike-groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  removeMember(groupId: string, memberUid: string): Promise<void> {
    return apiRequest(
      `/api/v1/hike-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberUid)}`,
      {
        method: 'DELETE',
      },
    );
  },
};
