/**
 * Image picker utility for map overlay images.
 *
 * Provides functions to capture photos or select from gallery,
 * and save them to the app's local file system for persistence.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Directory where overlay images are stored */
const OVERLAYS_DIR_NAME = 'map-overlays';

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
 * Copy an image to the app's local storage and return the new URI.
 */
async function copyImageToStorage(sourceUri: string): Promise<string> {
  const overlaysDir = getOverlaysDir();

  const ext = getExtension(sourceUri);
  const uuid = Math.random().toString(36).slice(2, 9);
  const filename = `overlay_${Date.now()}_${uuid}.${ext}`;
  const sourceFile = new File(sourceUri);
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
    quality: 0.8,
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
    quality: 0.8,
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
 */
export async function deleteOverlayImage(imageUri: string): Promise<void> {
  try {
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore errors when deleting
  }
}
