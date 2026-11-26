import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionTimeoutModal } from '@/features/auth/presentation/SessionTimeoutModal';
import { recordUserActivity } from '@/features/auth/presentation/useSessionGuard';

import { bootstrapApp } from './bootstrap';

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
        <View
          style={styles.root}
          onTouchStart={recordUserActivity}
          onStartShouldSetResponderCapture={() => {
            recordUserActivity();
            return false;
          }}
        >
          {children}
          <SessionTimeoutModal />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
