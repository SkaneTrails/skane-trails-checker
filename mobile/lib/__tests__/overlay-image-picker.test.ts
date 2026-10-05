import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({ Directory: vi.fn(), File: vi.fn(), Paths: {} }));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
}));
vi.mock('@/lib/overlay-image-compress', () => ({
  encodeJpeg: vi.fn(),
  encodeWithinBudget: vi.fn(),
}));

import * as ImagePicker from 'expo-image-picker';
import { encodeWithinBudget } from '@/lib/overlay-image-compress';
import {
  MAX_OVERLAY_IMAGE_BYTES,
  OverlayImageNotShrinkableError,
  OverlayImageProcessingError,
  OverlayImageTooLargeError,
  overlayImageErrorKey,
  pickImageFromGallery,
} from '../overlay-image-picker';

const mockEncode = vi.mocked(encodeWithinBudget);
const KB = 1024;
const MB = 1024 * KB;

function picked(size: number) {
  vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'blob:photo' }],
  } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => new Blob([new Uint8Array(size)]) })),
  );
}

describe('pickImageFromGallery (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a small image as a data URL without re-encoding it', async () => {
    picked(100 * KB);

    const uri = await pickImageFromGallery();

    expect(uri?.startsWith('data:')).toBe(true);
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('shrinks an image above the web storage budget', async () => {
    picked(3 * MB);
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(200 * KB)], { type: 'image/jpeg' }));

    const uri = await pickImageFromGallery();

    expect(mockEncode).toHaveBeenCalledTimes(1);
    expect(uri?.startsWith('data:image/jpeg')).toBe(true);
  });

  it('rejects an image over the hard cap before processing it', async () => {
    picked(MAX_OVERLAY_IMAGE_BYTES + 1);

    await expect(pickImageFromGallery()).rejects.toBeInstanceOf(OverlayImageTooLargeError);
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('reports a distinct error when the image cannot be shrunk enough', async () => {
    picked(5 * MB);
    mockEncode.mockResolvedValue(null);

    const error = await pickImageFromGallery().catch((e) => e);

    expect(error).toBeInstanceOf(OverlayImageNotShrinkableError);
    expect(error).not.toBeInstanceOf(OverlayImageTooLargeError);
  });

  it('wraps browser processing failures in a dedicated error', async () => {
    picked(5 * MB);
    const cause = new Error('decode failed');
    mockEncode.mockRejectedValue(cause);

    const error = await pickImageFromGallery().catch((e) => e);

    expect(error).toBeInstanceOf(OverlayImageProcessingError);
    expect(error.cause).toBe(cause);
  });

  it('returns null when the picker is cancelled', async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    expect(await pickImageFromGallery()).toBeNull();
  });
});

describe('overlayImageErrorKey', () => {
  it('maps each overlay image error to its own message', () => {
    expect(overlayImageErrorKey(new OverlayImageTooLargeError(1))).toBe('overlays.imageTooLarge');
    expect(overlayImageErrorKey(new OverlayImageNotShrinkableError(1))).toBe(
      'overlays.imageNotShrinkable',
    );
    expect(overlayImageErrorKey(new OverlayImageProcessingError(new Error('x')))).toBe(
      'overlays.imageProcessingFailed',
    );
  });

  it('returns null for unrelated errors so they are not swallowed', () => {
    expect(overlayImageErrorKey(new Error('boom'))).toBeNull();
  });
});
