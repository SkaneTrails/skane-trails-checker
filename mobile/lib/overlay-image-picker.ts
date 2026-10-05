/**
 * Image picker utility for map overlay images.
 *
 * Provides functions to capture photos or select from gallery,
 * and save them to the app's local file system for persistence.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { encodeJpeg, encodeWithinBudget } from '@/lib/overlay-image-compress';

/** Directory where overlay images are stored */
const OVERLAYS_DIR_NAME = 'map-overlays';

/** Maximum size of a picked overlay image, in bytes (10 MB). */
export const MAX_OVERLAY_IMAGE_BYTES = 10 * 1024 * 1024;

/** Web keeps the image inside localStorage (a few MB in total), so it is shrunk to fit this many bytes (0.75 MB). */
const WEB_STORED_MAX_BYTES = 0.75 * 1024 * 1024;

/** Thrown when a selected overlay image exceeds {@link MAX_OVERLAY_IMAGE_BYTES}. */
export class OverlayImageTooLargeError extends Error {
  readonly sizeBytes: number;
  constructor(sizeBytes: number) {
    super(`Overlay image is too large: ${sizeBytes} bytes (max ${MAX_OVERLAY_IMAGE_BYTES})`);
    this.name = 'OverlayImageTooLargeError';
    this.sizeBytes = sizeBytes;
  }
}

/**
 * Get the overlays directory, creating it if needed.
 */
function getOverlaysDir(): Directory {
  const dir = new Directory(Paths.document, OVERLAYS_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * Extract extension from a URI, defaulting to .jpg if unknown.
 */
function getExtension(uri: string): string {
  const match = uri.match(/\.(\w+)(?:\?.*)?$/);
  const ext = match?.[1]?.toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
  return ext && allowed.includes(ext) ? ext : 'jpg';
}

/**
 * Convert an image blob into a persistable `data:` URL so it survives reloads.
 * Blob/object URLs are only valid for the current document session and break
 * (ERR_FILE_NOT_FOUND) after a refresh.
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Copy an image to the app's local storage and return the new URI.
 *
 * On web, expo-file-system is not supported. The picker returns a transient
 * `blob:` object URL that does not survive a reload, so we convert it to a
 * persistable `data:` URL before storing, downscaling photos that would not fit
 * comfortably in localStorage.
 *
 * Throws {@link OverlayImageTooLargeError} if the image exceeds
 * {@link MAX_OVERLAY_IMAGE_BYTES} (or cannot be shrunk to fit on web).
 */
async function copyImageToStorage(sourceUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(sourceUri)).blob();
    if (blob.size > MAX_OVERLAY_IMAGE_BYTES) throw new OverlayImageTooLargeError(blob.size);
    if (blob.size <= WEB_STORED_MAX_BYTES) return blobToDataUrl(blob);

    const shrunk = await encodeWithinBudget((step) => encodeJpeg(blob, step), WEB_STORED_MAX_BYTES);
    if (!shrunk) throw new OverlayImageTooLargeError(blob.size);
    return blobToDataUrl(shrunk);
  }

  const overlaysDir = getOverlaysDir();

  const ext = getExtension(sourceUri);
  const uuid = Math.random().toString(36).slice(2, 9);
  const filename = `overlay_${Date.now()}_${uuid}.${ext}`;
  const sourceFile = new File(sourceUri);

  const sourceSize = sourceFile.size;
  if (sourceSize != null && sourceSize > MAX_OVERLAY_IMAGE_BYTES) {
    throw new OverlayImageTooLargeError(sourceSize);
  }

  const destFile = new File(overlaysDir, filename);

  await sourceFile.copy(destFile);

  return destFile.uri;
}

/**
 * Pick an image from the device gallery.
 * Returns the local file URI, or null if cancelled.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  // On native, request permissions
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.5,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  // Copy to app storage for persistence
  return copyImageToStorage(result.assets[0].uri);
}

/**
 * Capture a photo using the device camera.
 * Returns the local file URI, or null if cancelled.
 */
export async function captureImageFromCamera(): Promise<string | null> {
  // Camera not available on web
  if (Platform.OS === 'web') {
    return null;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    quality: 0.5,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  // Copy to app storage for persistence
  return copyImageToStorage(result.assets[0].uri);
}

/**
 * Delete an overlay image from storage.
 *
 * On web there is no file to remove (the URI is an in-memory `data:` URL), so
 * this is a no-op.
 */
export async function deleteOverlayImage(imageUri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore errors when deleting
  }
}
