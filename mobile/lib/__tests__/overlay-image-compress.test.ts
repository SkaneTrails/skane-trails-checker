import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENCODE_STEPS,
  type EncodeStep,
  encodeJpeg,
  encodeWithinBudget,
} from '../overlay-image-compress';

const blobOfSize = (size: number) => new Blob([new Uint8Array(size)]);

describe('encodeJpeg', () => {
  const close = vi.fn();
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(),
    toBlob: vi.fn(),
  };
  const bitmap = (width: number, height: number) => ({ width, height, close });

  beforeEach(() => {
    vi.clearAllMocks();
    ctx.fillStyle = '';
    canvas.getContext.mockReturnValue(ctx);
    canvas.toBlob.mockImplementation((cb: (b: Blob | null) => void) => cb(blobOfSize(10)));
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? canvas : realCreate(tag)) as typeof document.createElement);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap(4000, 3000)),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const step: EncodeStep = { maxDim: 2048, quality: 0.8 };

  it('scales the longest side down to maxDim and keeps the aspect ratio', async () => {
    await encodeJpeg(blobOfSize(1), step);

    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1536);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536);
  });

  it('never upscales a small image', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap(500, 400)),
    );

    await encodeJpeg(blobOfSize(1), step);

    expect([canvas.width, canvas.height]).toEqual([500, 400]);
  });

  it('paints a white background before drawing the image', async () => {
    const order: string[] = [];
    ctx.fillRect.mockImplementation(() => order.push(`fill:${ctx.fillStyle}`));
    ctx.drawImage.mockImplementation(() => order.push('draw'));

    await encodeJpeg(blobOfSize(1), step);

    expect(order).toEqual(['fill:#fff', 'draw']);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 2048, 1536);
  });

  it('encodes as JPEG at the requested quality and returns the blob', async () => {
    const out = await encodeJpeg(blobOfSize(1), { maxDim: 1024, quality: 0.5 });

    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.5);
    expect(out.size).toBe(10);
  });

  it('releases the bitmap after a successful encode', async () => {
    await encodeJpeg(blobOfSize(1), step);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects and still releases the bitmap when the browser cannot encode', async () => {
    canvas.toBlob.mockImplementation((cb: (b: Blob | null) => void) => cb(null));

    await expect(encodeJpeg(blobOfSize(1), step)).rejects.toThrow('JPEG encoding failed');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects and still releases the bitmap when there is no 2D context', async () => {
    canvas.getContext.mockReturnValue(null);

    await expect(encodeJpeg(blobOfSize(1), step)).rejects.toThrow('Canvas 2D context unavailable');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects when the image cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));

    await expect(encodeJpeg(blobOfSize(1), step)).rejects.toThrow('decode failed');
  });
});

describe('encodeWithinBudget', () => {
  it('stops at the first step that fits', async () => {
    const encode = vi.fn(async (step: EncodeStep) => blobOfSize(step.quality === 0.8 ? 500 : 100));

    const out = await encodeWithinBudget(encode, 1000);

    expect(out?.size).toBe(500);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith(ENCODE_STEPS[0]);
  });

  it('falls through to smaller steps until one fits', async () => {
    const sizes = [5000, 4000, 900, 100];
    let call = 0;
    const encode = vi.fn(async () => blobOfSize(sizes[call++]));

    const out = await encodeWithinBudget(encode, 1000);

    expect(out?.size).toBe(900);
    expect(encode).toHaveBeenCalledTimes(3);
  });

  it('returns null when even the smallest step is over budget', async () => {
    const encode = vi.fn(async () => blobOfSize(5000));

    expect(await encodeWithinBudget(encode, 1000)).toBeNull();
    expect(encode).toHaveBeenCalledTimes(ENCODE_STEPS.length);
  });

  it('only ever shrinks: later steps are never larger in dimension or quality', () => {
    for (let i = 1; i < ENCODE_STEPS.length; i++) {
      expect(ENCODE_STEPS[i].maxDim).toBeLessThanOrEqual(ENCODE_STEPS[i - 1].maxDim);
      expect(ENCODE_STEPS[i].quality).toBeLessThanOrEqual(ENCODE_STEPS[i - 1].quality);
    }
  });
});
