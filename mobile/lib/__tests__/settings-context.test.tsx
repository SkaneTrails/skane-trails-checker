import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLACE_CATEGORIES,
  SettingsProvider,
  useSettings,
} from '../settings-context';
import { DEFAULT_COMPLETED_COLOR, DEFAULT_PLANNED_COLOR } from '../trail-colors';

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

  it('throws when used outside SettingsProvider', () => {
    expect(() => {
      renderHook(() => useSettings());
    }).toThrow('useSettings must be used within a SettingsProvider');
  });
});

describe('useSettings — language settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setLanguage updates and persists', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.language).toBe('en');

    await act(async () => {
      await result.current.setLanguage('sv');
    });

    expect(result.current.language).toBe('sv');
    const lastCall = mockAsyncStorage.setItem.mock.calls.at(-1);
    const saved = JSON.parse(lastCall?.[1] as string);
    expect(saved.language).toBe('sv');
  });
});

describe('useSettings — default trail colors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to standard planned and completed colors', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.defaultPlannedColor).toBe(DEFAULT_PLANNED_COLOR);
    expect(result.current.defaultCompletedColor).toBe(DEFAULT_COMPLETED_COLOR);
  });

  it('loads persisted trail colors from AsyncStorage', async () => {
    const stored = { language: 'en', themeId: 'outdoor', defaultPlannedColor: '#38A169', defaultCompletedColor: '#805AD5' };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.defaultPlannedColor).toBe('#38A169');
    expect(result.current.defaultCompletedColor).toBe('#805AD5');
  });

  it('setDefaultPlannedColor updates and persists', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setDefaultPlannedColor('#FF8000');
    });

    expect(result.current.defaultPlannedColor).toBe('#FF8000');
    const lastCall = mockAsyncStorage.setItem.mock.calls.at(-1);
    const saved = JSON.parse(lastCall?.[1] as string);
    expect(saved.defaultPlannedColor).toBe('#FF8000');
  });

  it('setDefaultCompletedColor updates and persists', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setDefaultCompletedColor('#ED64A6');
    });

    expect(result.current.defaultCompletedColor).toBe('#ED64A6');
    const lastCall = mockAsyncStorage.setItem.mock.calls.at(-1);
    const saved = JSON.parse(lastCall?.[1] as string);
    expect(saved.defaultCompletedColor).toBe('#ED64A6');
  });
});

describe('useSettings — GPS tracking mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to balanced mode', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.gpsMode).toBe('balanced');
  });

  it('loads persisted gpsMode from AsyncStorage', async () => {
    const stored = { language: 'en', themeId: 'outdoor', gpsMode: 'high_precision' };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.gpsMode).toBe('high_precision');
  });

  it('falls back to balanced when stored gpsMode is invalid', async () => {
    const stored = { language: 'en', themeId: 'outdoor', gpsMode: 'invalid_mode' };
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.gpsMode).toBe('balanced');
  });

  it('setGpsMode updates and persists', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setGpsMode('high_precision');
    });

    expect(result.current.gpsMode).toBe('high_precision');
    const lastCall = mockAsyncStorage.setItem.mock.calls.at(-1);
    const saved = JSON.parse(lastCall?.[1] as string);
    expect(saved.gpsMode).toBe('high_precision');
  });
});
