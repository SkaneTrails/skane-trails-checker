import { useQueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { QueryProvider } from '../query-provider';

describe('QueryProvider', () => {
  test('provides a QueryClient to children', () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: ({ children }) => <QueryProvider>{children}</QueryProvider>,
    });

    expect(result.current).toBeDefined();
    expect(result.current.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
    expect(result.current.getDefaultOptions().queries?.retry).toBe(2);
    expect(result.current.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
