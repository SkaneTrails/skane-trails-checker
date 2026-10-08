import { type Query, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { shouldPersistQuery } from '../persist-filter';

function successfulQuery(queryKey: readonly unknown[]) {
  const client = new QueryClient();
  client.setQueryData(queryKey, { some: 'data' });
  return client.getQueryCache().find({ queryKey })!;
}

describe('shouldPersistQuery', () => {
  it.each([
    [['trails', 'list']],
    [['trails', 'image-pins']],
    [['places']],
    [['foraging', 'types']],
  ])('persists %j', (key) => {
    expect(shouldPersistQuery(successfulQuery(key))).toBe(true);
  });

  it.each([
    [['trails', 'map']],
    [['trails', 'detail', 'abc']],
    [['trails', 'details', 'abc']],
    [['trails', 'images', 'abc']],
  ])('does not persist the oversized %j', (key) => {
    expect(shouldPersistQuery(successfulQuery(key))).toBe(false);
  });

  it('does not persist queries that have not succeeded', () => {
    const client = new QueryClient();
    const query = client.getQueryCache().build(client, { queryKey: ['trails', 'list'] as const });
    expect(shouldPersistQuery(query as Query)).toBe(false);
  });
});
