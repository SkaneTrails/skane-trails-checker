import type { SyncStatus } from '@/lib/types';
import { apiRequest } from './client';

export const syncApi = {
  /** One version per data type; compare with the versions last synced, for equality only. */
  getStatus(): Promise<SyncStatus> {
    return apiRequest<SyncStatus>('/api/v1/sync/status');
  },
};
