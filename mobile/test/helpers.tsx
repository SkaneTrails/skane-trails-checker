import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { natureTheme, ThemeProvider } from '@/lib/theme';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function createQueryWrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ThemeProvider theme={natureTheme}>{children}</ThemeProvider>
      </QueryClientProvider>
    );
  };
}

export function createThemeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={natureTheme}>{children}</ThemeProvider>;
  };
}
