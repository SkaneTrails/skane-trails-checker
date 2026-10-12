/**
 * Native multipart parts.
 *
 * `fetch` on native (expo/fetch) cannot send React Native's `{ uri, name, type }` form parts, so the
 * picked file is copied into the cache under its upload name and sent as an expo-file-system `File`.
 * The copy also gives content:// URIs (Android document picker) a proper file name.
 */

import { Directory, File as FsFile, Paths } from 'expo-file-system';
import type { FormFile, UploadFile } from './form-file';

export type { FormFile, PickedFile, UploadFile } from './form-file';

export async function prepareFormFile(file: UploadFile): Promise<FormFile> {
  if (!('uri' in file)) return { part: file, dispose: () => {} };

  const dir = new Directory(Paths.cache, 'uploads');
  if (!dir.exists) dir.create();

  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const copy = new FsFile(dir, `${Date.now()}-${safeName}`);
  copy.create({ overwrite: true });
  copy.write(await new FsFile(file.uri).bytes());

  return {
    part: copy as unknown as Blob,
    dispose: () => {
      try {
        copy.delete();
      } catch {
        // The OS clears the cache anyway.
      }
    },
  };
}
