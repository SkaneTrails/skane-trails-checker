/**
 * Local copy of every trail with its map coordinates (native, one JSON file per trail).
 *
 * AsyncStorage is capped at about 6 MB on Android and the full trail set is several
 * times that, so trails live as files. An index file lists the trails and the last
 * sync time and is written last, so it only ever refers to complete trail files.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { Trail } from '@/lib/types';

export interface CachedMapTrails {
  trails: Trail[];
  lastSyncTime: string | null;
}

interface StoreIndex {
  lastSyncTime: string | null;
  ids: string[];
}

const DIRECTORY_NAME = 'map-trails';
const INDEX_FILE_NAME = 'index.json';

function openDirectory(): Directory {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  if (!directory.exists) directory.create({ idempotent: true });
  return directory;
}

function trailFile(directory: Directory, trailId: string): File {
  return new File(directory, `${encodeURIComponent(trailId)}.json`);
}

async function readIndex(directory: Directory): Promise<StoreIndex> {
  const indexFile = new File(directory, INDEX_FILE_NAME);
  if (!indexFile.exists) return { lastSyncTime: null, ids: [] };
  return JSON.parse(await indexFile.text()) as StoreIndex;
}

export const mapTrailStore = {
  /** Read every stored trail. Anything missing or unreadable counts as empty, forcing a full sync. */
  async get(): Promise<CachedMapTrails> {
    try {
      const directory = openDirectory();
      const index = await readIndex(directory);
      const trails = await Promise.all(
        index.ids.map(async (id) => JSON.parse(await trailFile(directory, id).text()) as Trail),
      );
      return { trails, lastSyncTime: index.lastSyncTime };
    } catch {
      return { trails: [], lastSyncTime: null };
    }
  },

  /** Store changed trails and drop deleted ones. Keeps the old sync time when none is given. */
  async apply(changed: Trail[], deletedIds: string[], lastSyncTime?: string): Promise<void> {
    try {
      const directory = openDirectory();
      const previous = await readIndex(directory).catch(
        (): StoreIndex => ({ lastSyncTime: null, ids: [] }),
      );
      const ids = new Set(previous.ids);

      for (const trail of changed) {
        trailFile(directory, trail.trail_id).write(JSON.stringify(trail));
        ids.add(trail.trail_id);
      }
      for (const id of deletedIds) {
        const file = trailFile(directory, id);
        if (file.exists) file.delete();
        ids.delete(id);
      }

      const index: StoreIndex = {
        lastSyncTime: lastSyncTime ?? previous.lastSyncTime,
        ids: Array.from(ids),
      };
      new File(directory, INDEX_FILE_NAME).write(JSON.stringify(index));
    } catch {
      // A failed write only costs a fuller sync on the next start.
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
