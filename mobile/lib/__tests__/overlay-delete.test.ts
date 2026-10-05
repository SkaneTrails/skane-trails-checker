import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapOverlay } from '../map-overlays';
import { confirmDeleteOverlay } from '../overlay-delete';

const deleteOverlayImage = vi.fn(async (_uri: string) => {});
vi.mock('@/lib/overlay-image-picker', () => ({
  deleteOverlayImage: (uri: string) => deleteOverlayImage(uri),
}));

const overlay = { id: 'o1', imageUri: 'file:///o1.jpg' } as MapOverlay;
const labels = { title: 'Delete', message: 'Delete this overlay?', cancel: 'Cancel' };

describe('confirmDeleteOverlay (web)', () => {
  beforeEach(() => {
    deleteOverlayImage.mockClear();
  });

  it('deletes the stored image and then the record when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteRecord = vi.fn(async () => {});

    confirmDeleteOverlay(overlay, labels, deleteRecord);

    await vi.waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('o1'));
    expect(deleteOverlayImage).toHaveBeenCalledWith('file:///o1.jpg');
  });

  it('deletes nothing when the user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteRecord = vi.fn();

    confirmDeleteOverlay(overlay, labels, deleteRecord);

    expect(deleteOverlayImage).not.toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});
