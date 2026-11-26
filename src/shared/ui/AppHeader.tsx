import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/core/utils/format';
import { useCustomer } from '@/features/accounts/presentation/hooks';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { colors, layout, radii, spacing, typography } from '@/shared/theme';

/** Indica a `<Screen />` que la cabecera ya aplicó el safe-area superior para evitar doble espacio. */
export const HeaderPresentContext = createContext(false);

export interface AppHeaderProps {
  sectionTitle?: string;
}

export function AppHeader({ sectionTitle }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const { data: customer } = useCustomer();

  const avatarText = initials(customer?.fullName ?? session?.email);

  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ir a Inicio de Banco Digital"
          style={styles.brandRow}
          onPress={() => router.push('/(tabs)')}
        >
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={18} color={colors.textOnPrimary} />
          </View>
          <View>
            <Text style={styles.brandName}>Banco Digital</Text>
            {sectionTitle ? <Text style={styles.sectionSubtitle}>{sectionTitle}</Text> : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil y seguridad"
          style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={styles.avatarText}>{avatarText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '800',
    lineHeight: 20,
  },
  sectionSubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    lineHeight: 14,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
});
