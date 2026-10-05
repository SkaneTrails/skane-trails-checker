/** Confirm, then delete an overlay's stored image and its record. Shared by every delete entry point. */

import { Alert, Platform } from 'react-native';
import type { MapOverlay } from '@/lib/map-overlays';
import { deleteOverlayImage } from '@/lib/overlay-image-picker';

interface DeleteLabels {
  title: string;
  message: string;
  cancel: string;
}

export function confirmDeleteOverlay(
  overlay: MapOverlay,
  labels: DeleteLabels,
  deleteRecord: (id: string) => Promise<void> | void,
): void {
  const doDelete = async () => {
    await deleteOverlayImage(overlay.imageUri);
    await deleteRecord(overlay.id);
  };

  if (Platform.OS === 'web') {
    if (window.confirm(labels.message)) void doDelete();
    return;
  }
  Alert.alert(labels.title, labels.message, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.title, style: 'destructive', onPress: () => void doDelete() },
  ]);
}
