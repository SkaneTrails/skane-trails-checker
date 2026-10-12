import { describe, expect, it } from 'vitest';
import { createSerialQueue } from '../serial-queue';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSerialQueue', () => {
  it('runs operations one at a time, in the order requested', async () => {
    const run = createSerialQueue();
    const log: string[] = [];

    const first = run(async () => {
      log.push('first start');
      await tick();
      log.push('first end');
    });
    const second = run(async () => {
      log.push('second start');
      await tick();
      log.push('second end');
    });
    await Promise.all([first, second]);

    expect(log).toEqual(['first start', 'first end', 'second start', 'second end']);
  });

  it('resolves each call with its own result', async () => {
    const run = createSerialQueue();
    const results = await Promise.all([run(async () => 1), run(async () => 2)]);
    expect(results).toEqual([1, 2]);
  });

  it('keeps going after an operation fails, and still reports that failure to its caller', async () => {
    const run = createSerialQueue();
    const failing = run(async () => {
      throw new Error('boom');
    });
    const next = run(async () => 'still runs');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('still runs');
  });
});
