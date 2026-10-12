import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_LAYERS, parseStoredLayers, useMapLayers } from '../map-layers';

const mockAsyncStorage = vi.mocked(AsyncStorage);

describe('parseStoredLayers', () => {
  it('returns the defaults when nothing is stored or the data is unusable', () => {
    expect(parseStoredLayers(null)).toEqual(DEFAULT_MAP_LAYERS);
    expect(parseStoredLayers('not json')).toEqual(DEFAULT_MAP_LAYERS);
    expect(parseStoredLayers('42')).toEqual(DEFAULT_MAP_LAYERS);
  });

  it('keeps stored booleans and defaults missing or invalid keys to on', () => {
    const stored = JSON.stringify({ foraging: false, places: 'no', trails: false });
    expect(parseStoredLayers(stored)).toEqual({
      trails: false,
      foraging: false,
      places: true,
      images: true,
    });
  });
});

describe('useMapLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  it('starts with every layer off until the saved choice has loaded', async () => {
    const { result } = renderHook(() => useMapLayers());
    expect(result.current.isLoaded).toBe(false);
    expect(Object.values(result.current.layers)).toEqual([false, false, false, false]);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
  });

  it('defaults every layer to on on first launch', async () => {
    const { result } = renderHook(() => useMapLayers());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.layers).toEqual(DEFAULT_MAP_LAYERS);
  });

  it('restores the layers saved on a previous launch', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ trails: true, foraging: false, places: false, images: true }),
    );
    const { result } = renderHook(() => useMapLayers());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.layers).toEqual({
      trails: true,
      foraging: false,
      places: false,
      images: true,
    });
  });

  it('persists a toggle', async () => {
    const { result } = renderHook(() => useMapLayers());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => result.current.toggleLayer('foraging'));

    expect(result.current.layers.foraging).toBe(false);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      '@skane_trails_map_layers',
      JSON.stringify({ ...DEFAULT_MAP_LAYERS, foraging: false }),
    );
  });

  it('ignores toggles before the saved choice has loaded', () => {
    const { result } = renderHook(() => useMapLayers());
    act(() => result.current.toggleLayer('trails'));
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to the defaults when storage fails', async () => {
    mockAsyncStorage.getItem.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useMapLayers());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.layers).toEqual(DEFAULT_MAP_LAYERS);
  });
});
