import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useState } from 'react';
import { createPersister } from '@/lib/storage/query-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cached data for persistence
      retry: 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
});

const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

export function QueryProvider({ children }: { children: ReactNode }) {
  const [persister] = useState(() => createPersister());

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
      {children}
    </PersistQueryClientProvider>
  );
}
