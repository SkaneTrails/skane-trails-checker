import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Platform } from 'react-native';

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

/** Lazy-loaded persistence wrapper — only imported on web to avoid bundling IndexedDB code on native. */
function WebPersistProvider({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic require avoids bundling on native
  const { PersistQueryClientProvider } = require('@tanstack/react-query-persist-client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createIdbPersister } = require('@/lib/storage/query-persister');
  const [persister] = useState(() => createIdbPersister());

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}>
      {children}
    </PersistQueryClientProvider>
  );
}
