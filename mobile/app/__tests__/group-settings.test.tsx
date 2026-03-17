/**
 * Tests for group-settings screen — ensures it handles groups with
 * undefined/empty members and grants superusers admin-level access.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '@/test/helpers';

// Controllable mocks
let mockGroupData: any = null;
let mockGroupLoading = false;
let mockMembersData: any[] = [];
let mockMembersLoading = false;
let mockCurrentUserData: any = null;
const mockAddMemberMutateAsync = vi.fn().mockResolvedValue({});
const mockUpdateRoleMutate = vi.fn();

vi.mock('expo-router', async () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({ id: 'group-1' }),
}));

// Mock the components barrel — TrackingControls only has platform-specific variants
// (.web.tsx / .native.tsx) so Vite can't resolve the base import in jsdom.
vi.mock('@/components', () => ({
  Button: (props: any) => React.createElement('button', { onClick: props.onPress, disabled: props.disabled }, props.title),
  ContentCard: ({ children }: any) => React.createElement('div', null, children),
  FormField: (props: any) => React.createElement('input', { value: props.value, onChange: (e: any) => props.onChangeText?.(e.target.value), placeholder: props.placeholder }),
}));

vi.mock('@/components/Chip', () => ({
  Chip: () => null,
}));

vi.mock('@/components/TabIcon', () => ({
  TabIcon: () => null,
}));

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ccc',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
      error: '#B00020',
      status: { exploredBg: '#E8F5E9', exploredText: '#2E7D32', toExploreBg: '#FFF3E0', toExploreText: '#E65100' },
      chip: { activeBg: '#2E7D32', activeText: '#fff', bg: '#f5f5f5', text: '#333' },
      glass: { background: 'rgba(255,255,255,0.8)', border: 'rgba(0,0,0,0.1)', surface: 'rgba(255,255,255,0.9)', borderSubtle: 'rgba(0,0,0,0.05)', activeHighlight: 'rgba(0,0,0,0.03)' },
    },
    shadows: {
      card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
      elevated: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    },
  }),
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, full: 9999 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 },
  fontWeight: { medium: '500', semibold: '600', bold: '700' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  sheet: { flex1: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center' } },
}));

vi.mock('@/lib/theme/styles', () => ({
  glassSheet: () => ({}),
  cssShadow: () => '',
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { email: 'alice@test.com' }, signOut: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-hike-groups', () => ({
  useHikeGroup: () => ({ data: mockGroupData, isLoading: mockGroupLoading }),
  useGroupMembers: () => ({ data: mockMembersData, isLoading: mockMembersLoading }),
  useCurrentUser: () => ({ data: mockCurrentUserData }),
  useUpdateHikeGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddMember: () => ({ mutateAsync: mockAddMemberMutateAsync, isPending: false }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateMemberRole: () => ({ mutate: mockUpdateRoleMutate, isPending: false }),
}));

async function renderScreen() {
  const { default: GroupSettingsScreen } = await import('@/app/group-settings');
  const Wrapper = createQueryWrapper();
  return render(
    React.createElement(Wrapper, null, React.createElement(GroupSettingsScreen)),
  );
}

describe('GroupSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupData = null;
    mockGroupLoading = false;
    mockMembersData = [];
    mockMembersLoading = false;
    mockCurrentUserData = null;
  });

  it('renders without crashing when group has no members', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 0, created_at: '', last_updated: '' };
    mockMembersData = [];
    mockCurrentUserData = { uid: 'u1', email: 'alice@test.com', role: 'member', group_id: 'group-1' };

    await renderScreen();

    expect(screen.getByText('Hemmestorp')).toBeInTheDocument();
  });

  it('renders members list when group has members', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 1, created_at: '', last_updated: '' };
    mockMembersData = [{ email: 'alice@test.com', group_id: 'group-1', role: 'admin', display_name: 'Alice' }];
    mockCurrentUserData = { uid: 'u1', email: 'alice@test.com', role: 'member', group_id: 'group-1' };

    await renderScreen();

    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('shows add-member form for superuser on any group', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 0, created_at: '', last_updated: '' };
    mockMembersData = [];
    mockCurrentUserData = { uid: 'u2', email: 'super@test.com', role: 'superuser', group_id: null };

    await renderScreen();

    expect(screen.getByText('settings.addMember')).toBeInTheDocument();
  });

  it('hides add-member form for non-admin members', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 1, created_at: '', last_updated: '' };
    mockMembersData = [{ email: 'admin@test.com', group_id: 'group-1', role: 'admin', display_name: 'Admin' }];
    mockCurrentUserData = { uid: 'u1', email: 'alice@test.com', role: 'member', group_id: 'group-1' };

    await renderScreen();

    expect(screen.queryByText('settings.addMember')).not.toBeInTheDocument();
  });

  it('shows role selector radio buttons in add-member form for admin', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 1, created_at: '', last_updated: '' };
    mockMembersData = [{ email: 'alice@test.com', group_id: 'group-1', role: 'admin', display_name: 'Alice' }];
    mockCurrentUserData = { uid: 'u1', email: 'alice@test.com', role: 'admin', group_id: 'group-1' };

    await renderScreen();

    expect(screen.getByText('settings.member')).toBeInTheDocument();
    // 'settings.admin' appears twice: role badge + role selector
    expect(screen.getAllByText('settings.admin').length).toBeGreaterThanOrEqual(2);
  });

  it('shows remove button for all non-self members when admin', async () => {
    mockGroupData = { group_id: 'group-1', name: 'Hemmestorp', member_count: 2, created_at: '', last_updated: '' };
    mockMembersData = [
      { email: 'alice@test.com', group_id: 'group-1', role: 'admin', display_name: 'Alice' },
      { email: 'bob@test.com', group_id: 'group-1', role: 'admin', display_name: 'Bob' },
    ];
    mockCurrentUserData = { uid: 'u1', email: 'alice@test.com', role: 'admin', group_id: 'group-1' };

    await renderScreen();

    const removeButtons = screen.getAllByText('settings.removeMember');
    expect(removeButtons).toHaveLength(1);
  });
});
