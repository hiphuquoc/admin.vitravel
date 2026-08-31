'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { AppToaster } from '@/components/ui/Toast';
import { BlockingProgressProvider } from '@/components/ui/BlockingProgress';
import { NavigationProgress } from '@/components/ui/NavigationProgress';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // List / crawler / dashboard: live refetch bình thường.
            // Form edit tự tắt qua EDIT_FORM_QUERY_OPTIONS (+ useFormHydration).
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            refetchInterval: 60_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <BlockingProgressProvider>
            <NavigationProgress>
              {children}
              <AppToaster />
            </NavigationProgress>
          </BlockingProgressProvider>
        </AuthProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
