import { describe, expect, it, vi } from 'vitest';
import { ENCODE_STEPS, type EncodeStep, encodeWithinBudget } from '../overlay-image-compress';

const blobOfSize = (size: number) => new Blob([new Uint8Array(size)]);

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
