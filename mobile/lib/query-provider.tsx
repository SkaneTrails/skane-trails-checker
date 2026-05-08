import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useState } from 'react';
import { createPersister } from '@/lib/storage/query-persister';
import { PERSIST_MAX_AGE } from '@/lib/storage/persist-constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: PERSIST_MAX_AGE, // 24 hours — keep cached data for persistence
      retry: 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  const [persister] = useState(() => createPersister());

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
      {children}
    </PersistQueryClientProvider>
  );
}
