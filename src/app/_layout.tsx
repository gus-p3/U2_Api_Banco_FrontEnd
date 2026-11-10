import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppProviders, queryClient } from '@/core/app/providers';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { colors } from '@/shared/theme';
import { Loader } from '@/shared/ui';

function NavigationGuard() {
  const status = useSessionStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

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

  if (status === 'booting') {
    return (
      <View style={styles.boot}>
        <Loader message="Iniciando Banca Digital..." />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <NavigationGuard />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
});
