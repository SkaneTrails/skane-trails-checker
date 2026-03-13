import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useState } from 'react';
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

export function QueryProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return <WebPersistProvider>{children}</WebPersistProvider>;
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Persistence wrapper — uses IndexedDB persister for offline cache on web. */
function WebPersistProvider({ children }: { children: ReactNode }) {
  const [persister] = useState(() => createIdbPersister());

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}>
      {children}
    </PersistQueryClientProvider>
  );
}
