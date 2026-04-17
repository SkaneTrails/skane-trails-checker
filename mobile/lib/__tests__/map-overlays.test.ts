import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateInitialCorners,
  getOverlayCenter,
  getOverlayRotation,
  rotateCorners,
  useMapOverlays,
  type GeoCoord,
  type MapOverlay,
} from '../map-overlays';

const mockAsyncStorage = vi.mocked(AsyncStorage);

describe('useMapOverlays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty overlays when storage is empty', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useMapOverlays());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overlays).toEqual([]);
    expect(result.current.visibleOverlays).toEqual([]);
  });

  it('loads persisted overlays from AsyncStorage', async () => {
    const stored: MapOverlay[] = [
      {
        id: 'overlay_1',
        name: 'Test Overlay',
        imageUri: 'file://test.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useMapOverlays());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0].name).toBe('Test Overlay');
  });

  it('addOverlay creates and persists a new overlay', async () => {
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useMapOverlays());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let newOverlay: MapOverlay | undefined;
    await act(async () => {
      newOverlay = await result.current.addOverlay({
        name: 'New Overlay',
        imageUri: 'file://new.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
      });
    });

    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0].name).toBe('New Overlay');
    expect(result.current.overlays[0].opacity).toBe(0.7); // Default opacity
    expect(result.current.overlays[0].visible).toBe(true);
    expect(newOverlay?.id).toMatch(/^overlay_/);
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('updateOverlay updates and persists changes', async () => {
    const stored: MapOverlay[] = [
      {
        id: 'overlay_1',
        name: 'Original Name',
        imageUri: 'file://test.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useMapOverlays());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateOverlay('overlay_1', {
        name: 'Updated Name',
        opacity: 0.5,
      });
    });

    expect(result.current.overlays[0].name).toBe('Updated Name');
    expect(result.current.overlays[0].opacity).toBe(0.5);
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('deleteOverlay removes and persists', async () => {
    const stored: MapOverlay[] = [
      {
        id: 'overlay_1',
        name: 'To Delete',
        imageUri: 'file://test.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useMapOverlays());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteOverlay('overlay_1');
    });

    expect(result.current.overlays).toHaveLength(0);
    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('toggleVisibility flips the visible flag', async () => {
    const stored: MapOverlay[] = [
      {
        id: 'overlay_1',
        name: 'Test',
        imageUri: 'file://test.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useMapOverlays());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.visibleOverlays).toHaveLength(1);

    await act(async () => {
      await result.current.toggleVisibility('overlay_1');
    });

    expect(result.current.overlays[0].visible).toBe(false);
    expect(result.current.visibleOverlays).toHaveLength(0);
  });

  it('visibleOverlays filters to only visible overlays', async () => {
    const stored: MapOverlay[] = [
      {
        id: 'overlay_1',
        name: 'Visible',
        imageUri: 'file://a.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'overlay_2',
        name: 'Hidden',
        imageUri: 'file://b.jpg',
        corners: [[56.0, 13.0], [56.0, 13.1], [55.9, 13.1], [55.9, 13.0]],
        opacity: 0.7,
        visible: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useMapOverlays());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.overlays).toHaveLength(2);
    expect(result.current.visibleOverlays).toHaveLength(1);
    expect(result.current.visibleOverlays[0].name).toBe('Visible');
  });
});

describe('calculateInitialCorners', () => {
  it('creates corners centered on given coordinates', () => {
    const corners = calculateInitialCorners(56.0, 13.0, 0.02, 0.01);

    // Top-left should be north-west of center
    expect(corners[0][0]).toBeGreaterThan(56.0); // Higher lat
    expect(corners[0][1]).toBeLessThan(13.0); // Lower lng

    // Bottom-right should be south-east of center
    expect(corners[2][0]).toBeLessThan(56.0); // Lower lat
    expect(corners[2][1]).toBeGreaterThan(13.0); // Higher lng

    // Should be symmetric
    const center = getOverlayCenter(corners);
    expect(center[0]).toBeCloseTo(56.0, 6);
    expect(center[1]).toBeCloseTo(13.0, 6);
  });
});

describe('getOverlayCenter', () => {
  it('calculates center of corners', () => {
    const corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord] = [
      [56.01, 12.99], // Top-left
      [56.01, 13.01], // Top-right
      [55.99, 13.01], // Bottom-right
      [55.99, 12.99], // Bottom-left
    ];

    const center = getOverlayCenter(corners);
    expect(center[0]).toBeCloseTo(56.0, 6);
    expect(center[1]).toBeCloseTo(13.0, 6);
  });
});

describe('rotateCorners', () => {
  it('rotates corners around center', () => {
    const corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord] = [
      [56.01, 12.99], // Top-left
      [56.01, 13.01], // Top-right
      [55.99, 13.01], // Bottom-right
      [55.99, 12.99], // Bottom-left
    ];

    // Rotate 90 degrees (π/2 radians)
    const rotated = rotateCorners(corners, Math.PI / 2);

    // After 90° rotation, top-left should move to where top-right was (roughly)
    // The center should remain the same
    const originalCenter = getOverlayCenter(corners);
    const rotatedCenter = getOverlayCenter(rotated);

    expect(rotatedCenter[0]).toBeCloseTo(originalCenter[0], 6);
    expect(rotatedCenter[1]).toBeCloseTo(originalCenter[1], 6);
  });

  it('returns same corners when rotating 0 degrees', () => {
    const corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord] = [
      [56.01, 12.99],
      [56.01, 13.01],
      [55.99, 13.01],
      [55.99, 12.99],
    ];

    const rotated = rotateCorners(corners, 0);

    expect(rotated[0][0]).toBeCloseTo(corners[0][0], 6);
    expect(rotated[0][1]).toBeCloseTo(corners[0][1], 6);
  });
});

describe('getOverlayRotation', () => {
  it('returns 0 for unrotated rectangle', () => {
    const corners: [GeoCoord, GeoCoord, GeoCoord, GeoCoord] = [
      [56.01, 12.99], // Top-left
      [56.01, 13.01], // Top-right (same lat, higher lng = pointing east)
      [55.99, 13.01],
      [55.99, 12.99],
    ];

    const rotation = getOverlayRotation(corners);
    expect(rotation).toBeCloseTo(0, 2);
  });
});
