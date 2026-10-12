import type { SyncStatusResponse } from '@/lib/types';
import { apiRequest } from './client';

export const syncApi = {
  /** One version per data type, for equality checks against the versions last synced, and the caller's scope. */
  getStatus(): Promise<SyncStatusResponse> {
    return apiRequest<SyncStatusResponse>('/api/v1/sync/status');
  },
};
