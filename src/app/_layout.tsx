import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { AppProviders, queryClient } from '@/core/app/providers';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { RemoteAuthListener } from '@/features/payments/presentation/RemoteAuthListener';
import { colors, radii, spacing, typography } from '@/shared/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const splashArt = require('../../assets/splash-icon.png');

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
        <Image source={splashArt} style={styles.splashImage} resizeMode="contain" />
        <View style={styles.splashBadge}>
          <Text style={styles.splashBadgeText}>BANCA DIGITAL</Text>
        </View>
        <Text style={styles.splashTitle}>Banco Digital</Text>
        <Text style={styles.splashSubtitle}>Tu alcancía y pagos al instante</Text>
        <ActivityIndicator size="small" color={colors.primary} style={styles.splashSpinner} />
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
      <RemoteAuthListener />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  splashImage: {
    width: 240,
    height: 240,
    marginBottom: spacing.sm,
  },
  splashBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  splashBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  splashTitle: {
    ...typography.title,
    color: colors.text,
  },
  splashSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  splashSpinner: {
    marginTop: spacing.lg,
  },
});
