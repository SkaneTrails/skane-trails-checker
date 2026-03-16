import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hikeGroupsApi } from '../hike-groups';

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../client';

const mockApiRequest = vi.mocked(apiRequest);

describe('hikeGroupsApi', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  describe('getCurrentUser', () => {
    it('fetches current user from /admin/me', async () => {
      const user = { uid: 'u1', email: 'a@b.com', role: 'member', group_id: 'g1', group_name: 'Hikers' };
      mockApiRequest.mockResolvedValue(user);
      const result = await hikeGroupsApi.getCurrentUser();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/me');
      expect(result).toEqual(user);
    });
  });

  describe('getGroups', () => {
    it('fetches all groups', async () => {
      mockApiRequest.mockResolvedValue([]);
      await hikeGroupsApi.getGroups();
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups');
    });
  });

  describe('getGroup', () => {
    it('fetches a single group by id', async () => {
      mockApiRequest.mockResolvedValue({ id: 'g1', name: 'Hikers' });
      await hikeGroupsApi.getGroup('g1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/g1');
    });

    it('encodes the group id', async () => {
      mockApiRequest.mockResolvedValue({});
      await hikeGroupsApi.getGroup('has spaces');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/has%20spaces');
    });
  });

  describe('createGroup', () => {
    it('posts to /admin/groups', async () => {
      mockApiRequest.mockResolvedValue({ id: 'g1', name: 'New' });
      await hikeGroupsApi.createGroup({ name: 'New' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'New' }),
      });
    });
  });

  describe('updateGroup', () => {
    it('patches the group', async () => {
      mockApiRequest.mockResolvedValue({ id: 'g1', name: 'Updated' });
      await hikeGroupsApi.updateGroup('g1', { name: 'Updated' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/g1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      });
    });
  });

  describe('deleteGroup', () => {
    it('deletes the group', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      await hikeGroupsApi.deleteGroup('g1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/g1', {
        method: 'DELETE',
      });
    });
  });

  describe('getMembers', () => {
    it('fetches members for a group', async () => {
      mockApiRequest.mockResolvedValue([]);
      await hikeGroupsApi.getMembers('g1');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/g1/members');
    });
  });

  describe('addMember', () => {
    it('posts member to group', async () => {
      mockApiRequest.mockResolvedValue({ id: 'g1' });
      await hikeGroupsApi.addMember('g1', { email: 'new@test.com' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/admin/groups/g1/members', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@test.com' }),
      });
    });
  });

  describe('removeMember', () => {
    it('deletes member from group', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      await hikeGroupsApi.removeMember('g1', 'old@test.com');
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/v1/admin/groups/g1/members/old%40test.com',
        { method: 'DELETE' },
      );
    });
  });
});
