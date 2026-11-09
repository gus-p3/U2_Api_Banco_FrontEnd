import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootstrapApp } from './bootstrap';
import { SessionTimeoutModal } from '@/features/auth/presentation/SessionTimeoutModal';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void bootstrapApp();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <SessionTimeoutModal />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
