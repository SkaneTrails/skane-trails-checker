import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const copies: {
    uri: string;
    create: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  }[] = [];
  return {
    copies,
    bytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };
});

vi.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  Directory: class {
    exists = true;
    create = vi.fn();
  },
  File: class {
    uri: string;
    create = vi.fn();
    write = vi.fn();
    delete = vi.fn();
    bytes = fs.bytes;
    constructor(...parts: unknown[]) {
      this.uri =
        typeof parts[1] === 'string' ? `file:///cache/uploads/${parts[1]}` : String(parts[0]);
      fs.copies.push(this);
    }
  },
}));

import { prepareFormFile } from '../form-file.native';

describe('prepareFormFile (native)', () => {
  beforeEach(() => {
    fs.copies.length = 0;
  });

  it('copies a picked file into the cache under its upload name', async () => {
    const { part, dispose } = await prepareFormFile({
      uri: 'content://docs/primary%3ADownload%2Ftrail',
      name: 'track.gpx',
      type: 'application/gpx+xml',
    });

    const copy = fs.copies.find((c) => c.uri.endsWith('-track.gpx'));
    expect(copy).toBeDefined();
    expect(copy?.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(part).toBe(copy);

    dispose();
    expect(copy?.delete).toHaveBeenCalled();
  });

  it('replaces characters that are unsafe in a file name', async () => {
    await prepareFormFile({ uri: 'file:///a.jpg', name: 'my photo/1.jpg', type: 'image/jpeg' });
    expect(fs.copies.some((c) => c.uri.endsWith('-my_photo_1.jpg'))).toBe(true);
  });

  it('passes a browser File through untouched', async () => {
    const file = new File(['x'], 'a.gpx');
    const { part } = await prepareFormFile(file);
    expect(part).toBe(file);
  });
});
