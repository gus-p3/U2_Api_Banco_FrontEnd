import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime } from '@/core/utils/format';
import { colors, spacing, typography } from '@/shared/theme';
import { Button, Card, EmptyState, ErrorState, ListItem, Loader, Screen } from '@/shared/ui';

import { useAccounts, useMovements } from './hooks';

export function AccountDetailScreen() {
  const router = useRouter();
  const { accountNumber } = useLocalSearchParams<{ accountNumber: string }>();
  const { accounts, refetch: refetchAccounts } = useAccounts();
  const account = accounts.find((a) => a.number === accountNumber);
  const movements = useMovements(accountNumber);

  const onRefresh = () => {
    void refetchAccounts();
    void movements.refetch();
  };

  return (
    <Screen refreshing={movements.isRefetching} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Button title="← Volver" variant="ghost" fullWidth={false} onPress={() => router.back()} />
        <Text style={styles.title}>Detalle de cuenta</Text>
      </View>

      <Card tone="primary" style={styles.hero}>
        <Text style={styles.number}>Cuenta {accountNumber}</Text>
        <Text style={styles.balance}>{account ? formatCurrency(account.balance) : '—'}</Text>
        <Text style={styles.meta}>Estatus: {account?.status ?? 'ACTIVA'}</Text>
      </Card>

      <Card style={styles.movCard}>
        <Text style={styles.sectionTitle}>Historial de movimientos</Text>
        {movements.isLoading ? (
          <Loader message="Consultando movimientos..." />
        ) : movements.isError ? (
          <ErrorState
            message={toAppError(movements.error).message}
            onRetry={() => void movements.refetch()}
          />
        ) : !movements.data?.length ? (
          <EmptyState
            title="Sin movimientos registrados"
            description="Aquí verás el detalle de tus cargos, abonos y pagos de servicios."
          />
        ) : (
          movements.data.map((m) => (
            <ListItem
              key={m.id}
              icon={m.signedAmount >= 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
              title={m.description || m.type}
              subtitle={`${m.type} · ${formatDateTime(m.createdAt)} · Saldo: ${formatCurrency(m.currentBalance)}`}
              trailing={`${m.signedAmount >= 0 ? '+' : ''}${formatCurrency(m.signedAmount)}`}
              trailingTone={m.signedAmount >= 0 ? 'positive' : 'negative'}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.heading, color: colors.primary },
  hero: { gap: spacing.xs },
  number: { ...typography.caption, color: colors.accentLight },
  balance: { ...typography.amount, color: colors.textOnPrimary },
  meta: { ...typography.caption, color: colors.accentLight },
  movCard: { gap: spacing.xs },
  sectionTitle: { ...typography.subheading, color: colors.primary },
});
