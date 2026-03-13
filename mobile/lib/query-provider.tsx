import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { createIdbPersister } from '@/lib/storage/query-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cached data for persistence
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = Platform.OS === 'web' ? createIdbPersister() : undefined;

export function QueryProvider({ children }: { children: ReactNode }) {
  if (persister) {
    return (
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}>
        {children}
      </PersistQueryClientProvider>
    );
  }

  // Native platforms: no IndexedDB, fall back to regular provider
  const { QueryClientProvider } = require('@tanstack/react-query');
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
