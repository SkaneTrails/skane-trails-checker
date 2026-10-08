/**
 * Local copy of each trail's photos (native, one JSON file per trail).
 *
 * A copy is only used while its revision equals the trail's `images_revision`, so photos are
 * downloaded once and again only after they change. Each file records its owner (the signed-in
 * user); another user's file reads as missing and is deleted.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { TrailImage } from '@/lib/types';
import { createSerialQueue } from './serial-queue';

export interface CachedTrailImages {
  revision: string;
  images: TrailImage[];
}

interface StoredFile extends CachedTrailImages {
  ownerUid: string;
}

const DIRECTORY_NAME = 'trail-images';

function openDirectory(): Directory {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  if (!directory.exists) directory.create({ idempotent: true });
  return directory;
}

function imageFile(directory: Directory, trailId: string): File {
  return new File(directory, `${encodeURIComponent(trailId)}.json`);
}

const unqueuedStore = {
  async get(ownerUid: string, trailId: string): Promise<CachedTrailImages | null> {
    try {
      const file = imageFile(openDirectory(), trailId);
      if (!file.exists) return null;
      const stored = JSON.parse(await file.text()) as StoredFile;
      if (stored.ownerUid !== ownerUid) {
        file.delete();
        return null;
      }
      return { revision: stored.revision, images: stored.images };
    } catch {
      return null;
    }
  },

  async put(
    ownerUid: string,
    trailId: string,
    revision: string,
    images: TrailImage[],
  ): Promise<void> {
    try {
      const stored: StoredFile = { ownerUid, revision, images };
      imageFile(openDirectory(), trailId).write(JSON.stringify(stored));
    } catch {
      // Not caching only means downloading the photos again next time.
    }
  },

  async remove(trailId: string): Promise<void> {
    try {
      const file = imageFile(openDirectory(), trailId);
      if (file.exists) file.delete();
    } catch {
      // Nothing to remove.
    }
  },

  async clear(): Promise<void> {
    try {
      const directory = new Directory(Paths.document, DIRECTORY_NAME);
      if (directory.exists) directory.delete();
    } catch {
      // Nothing to clear.
    }
  },
};

const serialize = createSerialQueue();

export const trailImageStore = {
  get: (ownerUid: string, trailId: string) => serialize(() => unqueuedStore.get(ownerUid, trailId)),
  put: (...args: Parameters<typeof unqueuedStore.put>) => serialize(() => unqueuedStore.put(...args)),
  remove: (trailId: string) => serialize(() => unqueuedStore.remove(trailId)),
  clear: () => serialize(() => unqueuedStore.clear()),
};
