/**
 * Local copy of every trail with its map coordinates (native, one JSON file per trail).
 *
 * AsyncStorage is capped at about 6 MB on Android and the full trail set is several
 * times that, so trails live as files. An index file lists the trails and the last
 * sync time and is written last, so it only ever refers to complete trail files.
 *
 * The copy belongs to one signed-in user and one visibility scope (their group, or
 * everything for a superuser). Asking for it as another user erases it, so private
 * trails never carry over and a cursor from one scope is never sent for another.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { Trail } from '@/lib/types';

export interface CachedMapTrails {
  trails: Trail[];
  lastSyncTime: string | null;
  /** Scope the server reported at the last sync, or null before the first one. */
  scope: string | null;
}

/** Position the local copy has reached, taken from the server's response. */
export interface MapSyncState {
  lastSyncTime: string;
  scope: string;
}

interface StoreIndex {
  ownerUid: string | null;
  lastSyncTime: string | null;
  scope: string | null;
  ids: string[];
}

const DIRECTORY_NAME = 'map-trails';
const INDEX_FILE_NAME = 'index.json';
const EMPTY: CachedMapTrails = { trails: [], lastSyncTime: null, scope: null };
const EMPTY_INDEX: StoreIndex = { ownerUid: null, lastSyncTime: null, scope: null, ids: [] };

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
  if (!indexFile.exists) return EMPTY_INDEX;
  return { ...EMPTY_INDEX, ...(JSON.parse(await indexFile.text()) as Partial<StoreIndex>) };
}

/** Remove the index first: without it the trail files are unreachable, even if deleting them fails part-way. */
function eraseStore(): void {
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  if (!directory.exists) return;
  const indexFile = new File(directory, INDEX_FILE_NAME);
  if (indexFile.exists) indexFile.delete();
  directory.delete();
}

export const mapTrailStore = {
  /**
   * Read the copy that belongs to `ownerUid`; another user's copy is erased and reads as empty.
   * Anything missing or unreadable also reads as empty, forcing a full sync.
   */
  async get(ownerUid: string): Promise<CachedMapTrails> {
    try {
      const directory = openDirectory();
      const index = await readIndex(directory);
      if (index.ownerUid !== ownerUid) {
        eraseStore();
        return EMPTY;
      }
      const trails = await Promise.all(
        index.ids.map(async (id) => JSON.parse(await trailFile(directory, id).text()) as Trail),
      );
      return { trails, lastSyncTime: index.lastSyncTime, scope: index.scope };
    } catch {
      return EMPTY;
    }
  },

  /**
   * Store changed trails and drop deleted ones for `ownerUid`, replacing another user's copy.
   * Keeps the previous sync position when none is given.
   */
  async apply(
    ownerUid: string,
    changed: Trail[],
    deletedIds: string[],
    sync?: MapSyncState,
  ): Promise<void> {
    try {
      let directory = openDirectory();
      let previous = await readIndex(directory).catch((): StoreIndex => EMPTY_INDEX);
      if (previous.ownerUid !== ownerUid) {
        eraseStore();
        directory = openDirectory();
        previous = EMPTY_INDEX;
      }
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
        ownerUid,
        lastSyncTime: sync?.lastSyncTime ?? previous.lastSyncTime,
        scope: sync?.scope ?? previous.scope,
        ids: Array.from(ids),
      };
      new File(directory, INDEX_FILE_NAME).write(JSON.stringify(index));
    } catch {
      // A failed write only costs a fuller sync on the next start.
    }
  },

  async clear(): Promise<void> {
    try {
      eraseStore();
    } catch {
      // Nothing to clear.
    }
  },
};
