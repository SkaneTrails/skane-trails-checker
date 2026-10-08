/**
 * The tab layout holds back the signed-in screens until the data on the device is known to
 * belong to the signed-in user, including the dev-mode user, which has no uid.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';

let mockUser: { email: string; uid?: string } | null = null;
let mockCurrentUser: { uid: string } | undefined;

vi.mock('expo-router', () => ({
  Slot: () => React.createElement('div', { 'data-testid': 'slot' }),
  Redirect: () => null,
}));

vi.mock('@/components', () => ({ Button: () => null }));

vi.mock('@/lib/api', () => ({
  ApiClientError: class ApiClientError extends Error {
    status = 0;
  },
}));

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({ colors: { background: '#fff', primary: '#2E7D32' } }),
  fontSize: {},
  spacing: {},
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

vi.mock('@/lib/hooks/use-hike-groups', () => ({
  useCurrentUser: () => ({
    data: mockCurrentUser,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-scope', () => ({ currentUserId: vi.fn(() => 'anonymous') }));

vi.mock('@/lib/sync/poll-sync-status', () => ({
  claimLocalData: vi.fn(),
  pollSyncStatus: vi.fn().mockResolvedValue(undefined),
}));

import { claimLocalData, pollSyncStatus } from '@/lib/sync/poll-sync-status';

async function renderLayout() {
  const { default: TabLayout } = await import('@/app/(tabs)/_layout');
  const Wrapper = createQueryWrapper();
  return render(React.createElement(Wrapper, null, React.createElement(TabLayout)));
}

describe('TabLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockCurrentUser = undefined;
    vi.mocked(claimLocalData).mockResolvedValue({ ownerUid: 'anonymous', scope: null, seen: {} });
  });

  it('shows the screens for the dev-mode user, who has no uid, once the owner check is done', async () => {
    mockUser = { email: 'dev@localhost' };
    mockCurrentUser = { uid: 'dev-user' };

    await renderLayout();

    await waitFor(() => expect(screen.getByTestId('slot')).toBeTruthy());
    expect(claimLocalData).toHaveBeenCalledOnce();
  });

  it('shows nothing from the device until the owner check is done', async () => {
    mockUser = { email: 'a@test.com', uid: 'u1' };
    let finish: (value: never) => void = () => undefined;
    vi.mocked(claimLocalData).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await renderLayout();
    expect(screen.queryByTestId('slot')).toBeNull();

    finish({ ownerUid: 'anonymous', scope: null, seen: {} } as never);
    await waitFor(() => expect(screen.getByTestId('slot')).toBeTruthy());
  });

  it('starts polling only after the owner check', async () => {
    mockUser = { email: 'a@test.com', uid: 'u1' };
    mockCurrentUser = { uid: 'u1' };
    let finish: (value: never) => void = () => undefined;
    vi.mocked(claimLocalData).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await renderLayout();
    expect(pollSyncStatus).not.toHaveBeenCalled();

    finish({ ownerUid: 'anonymous', scope: null, seen: {} } as never);
    await waitFor(() => expect(pollSyncStatus).toHaveBeenCalledOnce());
  });

  it('does not check anything while signed out', async () => {
    await renderLayout();

    expect(screen.getByTestId('slot')).toBeTruthy();
    expect(claimLocalData).not.toHaveBeenCalled();
  });
});
