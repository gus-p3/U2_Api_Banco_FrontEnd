import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDate, maskAccount } from '@/core/utils/format';
import { colors, spacing, typography } from '@/shared/theme';
import { Card, EmptyState, ErrorState, ListItem, Loader, Screen } from '@/shared/ui';

import { useAccounts } from './hooks';

export function AccountsScreen() {
  const router = useRouter();
  const { accounts, total, isLoading, isError, error, refetch, isRefetching } = useAccounts();

  if (isLoading) {
    return (
      <Screen>
        <Loader message="Cargando cuentas..." />
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
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Text style={styles.title}>Mis cuentas</Text>

      <Card tone="primary" style={styles.summary}>
        <Text style={styles.summaryLabel}>Patrimonio en cuentas activas</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(total)}</Text>
      </Card>

      <Card style={styles.listCard}>
        {accounts.length === 0 ? (
          <EmptyState title="No tienes cuentas registradas" />
        ) : (
          accounts.map((acc) => (
            <ListItem
              key={acc.number}
              icon="wallet-outline"
              title={`Cuenta ${acc.number} (${maskAccount(acc.number)})`}
              subtitle={`Estatus: ${acc.status}${acc.openedAt ? ` · Apertura ${formatDate(acc.openedAt)}` : ''}`}
              trailing={formatCurrency(acc.balance)}
              onPress={() => router.push(`/account/${acc.number}`)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.primary },
  summary: { gap: spacing.xs },
  summaryLabel: { ...typography.caption, color: colors.accentLight },
  summaryAmount: { ...typography.amount, color: colors.textOnPrimary },
  listCard: { gap: spacing.xs },
});
