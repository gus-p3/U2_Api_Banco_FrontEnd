import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime, maskAccount } from '@/core/utils/format';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Card, EmptyState, ErrorState, ListItem, Loader, Screen } from '@/shared/ui';

import { useAccounts, useRecentMovements } from './hooks';

export function HomeScreen() {
  const router = useRouter();
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

      <Card tone="primary" style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo total disponible</Text>
        <Text style={styles.balanceValue}>{formatCurrency(total)}</Text>
        {primary ? (
          <Text style={styles.accountBadge}>
            Cuenta principal {maskAccount(primary.number)} · {primary.status}
          </Text>
        ) : null}
      </Card>

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
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 2 },
  hello: { ...typography.heading, color: colors.primary },
  sub: { ...typography.caption, color: colors.textMuted },
  balanceCard: { gap: spacing.xs, paddingVertical: spacing.xl },
  balanceLabel: {
    ...typography.caption,
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceValue: { ...typography.amount, color: colors.textOnPrimary },
  accountBadge: { ...typography.caption, color: colors.accentLight, marginTop: spacing.xs },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  sectionCard: { gap: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.subheading, color: colors.primary },
  link: { ...typography.caption, color: colors.primaryLight, fontWeight: '600' },
});
