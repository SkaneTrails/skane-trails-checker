import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLACE_CATEGORIES,
  SettingsProvider,
  useSettings,
} from '../settings-context';

const mockAsyncStorage = vi.mocked(AsyncStorage);

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsProvider>{children}</SettingsProvider>;
  };
}

describe('useSettings — place category filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to parking, water, and toilets', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabledPlaceCategories).toEqual(DEFAULT_PLACE_CATEGORIES);
    expect(result.current.enabledPlaceCategories).toContain('parkering');
    expect(result.current.enabledPlaceCategories).toContain('vatten');
    expect(result.current.enabledPlaceCategories).toContain('toalett');
  });

  it('loads persisted categories from AsyncStorage', async () => {
    const stored = { language: 'en', themeId: 'outdoor', enabledPlaceCategories: ['badplats', 'boende'] };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabledPlaceCategories).toEqual(['badplats', 'boende']);
  });

  it('falls back to defaults when stored data has no enabledPlaceCategories', async () => {
    const stored = { language: 'sv', themeId: 'outdoor' };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabledPlaceCategories).toEqual(DEFAULT_PLACE_CATEGORIES);
  });

  it('togglePlaceCategory adds a category', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.togglePlaceCategory('badplats');
    });

    expect(result.current.enabledPlaceCategories).toContain('badplats');
    expect(result.current.enabledPlaceCategories).toContain('parkering');
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('togglePlaceCategory removes an already-enabled category', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.enabledPlaceCategories).toContain('parkering');

    await act(async () => {
      await result.current.togglePlaceCategory('parkering');
    });

    expect(result.current.enabledPlaceCategories).not.toContain('parkering');
    expect(result.current.enabledPlaceCategories).toContain('vatten');
  });

  it('setEnabledPlaceCategories replaces the whole list', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setEnabledPlaceCategories(['konst', 'boende']);
    });

    expect(result.current.enabledPlaceCategories).toEqual(['konst', 'boende']);
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('persists changes to AsyncStorage', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.togglePlaceCategory('boende');
    });

    const lastCall = mockAsyncStorage.setItem.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('@skane_trails_settings');
    const saved = JSON.parse(lastCall?.[1] as string);
    expect(saved.enabledPlaceCategories).toContain('boende');
  });
});
