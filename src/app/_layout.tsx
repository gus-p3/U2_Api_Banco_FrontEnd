import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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
