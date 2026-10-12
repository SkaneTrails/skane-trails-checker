/**
 * Run async operations one at a time, in the order they were requested.
 *
 * The map trail store reads its index, changes it and writes it back, and the mutation hooks
 * call it without waiting, so overlapping calls would otherwise overwrite each other's changes.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
}
