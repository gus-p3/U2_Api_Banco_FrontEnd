import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppProviders, queryClient } from '@/core/app/providers';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { RemoteAuthListener } from '@/features/payments/presentation/RemoteAuthListener';
import { colors } from '@/shared/theme';
import { AnimatedSplash } from '@/shared/ui/AnimatedSplash';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function NavigationGuard() {
  const status = useSessionStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // En Web, si Railway despliega una nueva versión con hashes JS distintos mientras hay una pestaña abierta,
  // recarga automáticamente una vez para evitar pantalla en blanco por chunk desactualizado.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleChunkError = (msg: string) => {
      if (
        !/ChunkLoadError|Loading chunk|Unexpected token '<'|Failed to fetch dynamically imported module/i.test(
          msg,
        )
      ) {
        return;
      }
      try {
        const key = 'banco_chunk_reload_at';
        const last = Number(window.sessionStorage.getItem(key) ?? '0');
        if (Date.now() - last > 30_000) {
          window.sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    };
    const onError = (e: ErrorEvent) => handleChunkError(e.message || String(e.error ?? ''));
    const onRejection = (e: PromiseRejectionEvent) => handleChunkError(String(e.reason ?? ''));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    if (status === 'booting') return;
    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'unauthenticated') {
      queryClient.clear();
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, segments, router]);

  return (
    <View style={styles.root}>
      {status === 'booting' ? (
        <View style={styles.boot} />
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
      <AnimatedSplash appReady={status !== 'booting'} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <NavigationGuard />
      <RemoteAuthListener />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  boot: { flex: 1, backgroundColor: colors.surface },
});
