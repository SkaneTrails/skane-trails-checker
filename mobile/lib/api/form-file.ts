/** A file picked on a device: the picker hands back a URI instead of a `File`. */
export interface PickedFile {
  uri: string;
  type: string;
  name: string;
}

/** What a multipart upload accepts: a browser `File` on web, a picked file on native. */
export type UploadFile = File | PickedFile;

export interface FormFile {
  part: Blob | PickedFile;
  /** Removes any temporary copy once the request is done. */
  dispose: () => void;
}

/** Web uses the browser `File` as it is. */
export async function prepareFormFile(file: UploadFile): Promise<FormFile> {
  return { part: file, dispose: () => {} };
}
