import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime, maskAccount } from '@/core/utils/format';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Card, EmptyState, ErrorState, ListItem, Loader, Screen } from '@/shared/ui';

import { useAccounts, useRecentMovements } from './hooks';

export function HomeScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const {
    data: customer,
    accounts,
    total,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAccounts();
  const primary = customer?.primaryAccount ?? accounts[0];
  const movements = useRecentMovements(primary?.number, 5);

  const onRefresh = () => {
    void refetch();
    void movements.refetch();
  };

  if (isLoading) {
    return (
      <Screen>
        <Loader message="Cargando tu resumen bancario..." />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message={toAppError(error).message} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={isRefetching} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <Text style={styles.hello}>Hola, {customer?.firstName ?? 'Cliente'}</Text>
        <Text style={styles.sub}>Bienvenido a tu banca digital</Text>
      </View>

      {isWeb ? (
        <View style={styles.webSecurityBanner}>
          <Ionicons name="finger-print" size={18} color={colors.primary} />
          <Text style={styles.webSecurityText}>
            Seguridad 2FA activa: los pagos iniciados en Web se autorizan con tu huella digital desde tu
            celular Android.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver datos y movimientos de mi cuenta principal"
        disabled={!primary}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        onPress={() => {
          if (primary) {
            router.push(`/account/${primary.number}`);
          }
        }}
      >
        <Card tone="primary" style={styles.balanceCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.balanceLabel}>Saldo disponible</Text>
            <View style={styles.heroChip}>
              <Ionicons name="sparkles" size={13} color={colors.textOnPrimary} />
              <Text style={styles.heroChipText}>{primary?.status ?? 'ACTIVA'}</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>{formatCurrency(total)}</Text>
          {primary ? (
            <View style={styles.heroBottomRow}>
              <View style={styles.accountBadgeWrap}>
                <Text style={styles.accountBadge}>Cuenta principal {maskAccount(primary.number)}</Text>
              </View>
              <View style={styles.heroLinkRow}>
                <Text style={styles.heroLinkText}>Ver datos</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textOnPrimary} />
              </View>
            </View>
          ) : null}
        </Card>
      </Pressable>

      <View style={styles.quickRow}>
        <QuickAction
          icon="phone-portrait-outline"
          label="Recargas"
          onPress={() => router.push('/(tabs)/payments?tab=RECARGA')}
        />
        <QuickAction
          icon="receipt-outline"
          label="Servicios"
          onPress={() => router.push('/(tabs)/payments?tab=SERVICIO')}
        />
        <QuickAction
          icon="wallet-outline"
          label="Cuentas"
          onPress={() => router.push('/(tabs)/accounts')}
        />
        <QuickAction
          icon="shield-checkmark-outline"
          label="Seguridad"
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Mis cuentas</Text>
        {accounts.length === 0 ? (
          <EmptyState title="Sin cuentas registradas" />
        ) : (
          accounts.map((acc) => (
            <ListItem
              key={acc.number}
              icon="card-outline"
              title={`Cuenta ${maskAccount(acc.number)}`}
              subtitle={`Estatus: ${acc.status}`}
              trailing={formatCurrency(acc.balance)}
              onPress={() => router.push(`/account/${acc.number}`)}
            />
          ))
        )}
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos movimientos</Text>
          {primary ? (
            <Pressable onPress={() => router.push(`/account/${primary.number}`)}>
              <Text style={styles.link}>Ver todos</Text>
            </Pressable>
          ) : null}
        </View>
        {movements.isLoading ? (
          <Loader message="Cargando movimientos..." />
        ) : movements.isError ? (
          <ErrorState
            message={toAppError(movements.error).message}
            onRetry={() => void movements.refetch()}
          />
        ) : !movements.data?.length ? (
          <EmptyState
            title="Aún no tienes movimientos"
            description="Tus pagos y abonos aparecerán aquí."
          />
        ) : (
          movements.data.map((m) => (
            <ListItem
              key={m.id}
              icon={m.signedAmount >= 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
              title={m.description || m.type}
              subtitle={formatDateTime(m.createdAt)}
              trailing={`${m.signedAmount >= 0 ? '+' : ''}${formatCurrency(m.signedAmount)}`}
              trailingTone={m.signedAmount >= 0 ? 'positive' : 'negative'}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 2 },
  hello: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted },
  webSecurityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  webSecurityText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  balanceCard: { gap: spacing.sm, paddingVertical: spacing.xl },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  heroChipText: { fontSize: 11, fontWeight: '700', color: colors.textOnPrimary, letterSpacing: 0.6 },
  balanceLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '700',
  },
  balanceValue: { ...typography.amount, color: colors.textOnPrimary },
  accountBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  accountBadge: { ...typography.caption, color: colors.textOnPrimary, fontWeight: '600' },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  heroLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heroLinkText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  sectionCard: { gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  link: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
