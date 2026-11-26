import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDate, formatDateTime, maskAccount } from '@/core/utils/format';
import { authDeps } from '@/features/auth/di';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, EmptyState, ErrorState, ListItem, Loader, Screen } from '@/shared/ui';

import { useAccounts, useMovements } from './hooks';

export function AccountDetailScreen() {
  const router = useRouter();
  const { accountNumber } = useLocalSearchParams<{ accountNumber: string }>();
  const { data: customer, accounts, refetch: refetchAccounts } = useAccounts();
  const account = accounts.find((a) => a.number === accountNumber);
  const movements = useMovements(accountNumber);

  const [revealed, setRevealed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const onRefresh = () => {
    void refetchAccounts();
    void movements.refetch();
  };

  const handleToggleReveal = async () => {
    setAuthError(null);
    if (revealed) {
      setRevealed(false);
      return;
    }

    if (Platform.OS === 'web') {
      setAuthError(
        'Por seguridad, revelar el número completo de cuenta requiere verificación con huella digital en la app móvil.',
      );
      return;
    }

    setVerifying(true);
    try {
      const available = await authDeps.biometrics.isAvailable();
      if (!available) {
        setAuthError(
          'Configura una huella digital en tu dispositivo Android para revelar los datos completos de tu cuenta.',
        );
        return;
      }
      const ok = await authDeps.biometrics.authenticate(
        'Coloca tu huella digital para ver los datos completos de tu cuenta',
      );
      if (ok) {
        setRevealed(true);
      } else {
        setAuthError('Verificación biométrica cancelada o no reconocida.');
      }
    } catch (e) {
      setAuthError(toAppError(e).message);
    } finally {
      setVerifying(false);
    }
  };

  const displayAccount = revealed ? (accountNumber ?? '—') : maskAccount(accountNumber ?? '');

  return (
    <Screen refreshing={movements.isRefetching} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Button title="← Volver" variant="ghost" fullWidth={false} onPress={() => router.back()} />
        <Text style={styles.title}>Detalle de cuenta</Text>
      </View>

      <Card tone="primary" style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.number}>Cuenta principal {displayAccount}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar datos completos' : 'Ver datos completos'}
            style={styles.revealPill}
            disabled={verifying}
            onPress={() => void handleToggleReveal()}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={15}
              color={colors.textOnPrimary}
            />
            <Text style={styles.revealPillText}>{revealed ? 'Ocultar' : 'Ver datos completos'}</Text>
          </Pressable>
        </View>
        <Text style={styles.balance}>{account ? formatCurrency(account.balance) : '—'}</Text>
        <Text style={styles.meta}>Estatus: {account?.status ?? 'ACTIVA'}</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Datos de la cuenta</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Titular</Text>
          <Text style={styles.infoValue}>{customer?.fullName ?? '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Número de cuenta</Text>
          <Text style={styles.infoValue}>{displayAccount}</Text>
        </View>
        {revealed && customer?.curp ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CURP</Text>
            <Text style={styles.infoValue}>{customer.curp}</Text>
          </View>
        ) : null}
        {revealed && customer?.rfc ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RFC</Text>
            <Text style={styles.infoValue}>{customer.rfc}</Text>
          </View>
        ) : null}
        {account?.openedAt ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de apertura</Text>
            <Text style={styles.infoValue}>{formatDate(account.openedAt)}</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estatus</Text>
          <Text style={styles.infoValue}>{account?.status ?? 'ACTIVA'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Moneda</Text>
          <Text style={styles.infoValue}>MXN (Pesos mexicanos)</Text>
        </View>

        <Button
          title={revealed ? 'Ocultar datos completos' : 'Ver datos completos'}
          variant={revealed ? 'outline' : 'secondary'}
          loading={verifying}
          onPress={() => void handleToggleReveal()}
        />

        {authError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {authError}
          </Text>
        ) : null}
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
  title: { ...typography.heading, color: colors.text },
  hero: { gap: spacing.xs, paddingVertical: spacing.xl },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  number: { ...typography.caption, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', flex: 1 },
  revealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  revealPillText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  balance: { ...typography.amount, color: colors.textOnPrimary },
  meta: { ...typography.caption, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' },
  infoCard: { gap: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  infoLabel: { ...typography.caption, color: colors.textMuted },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  errorText: { ...typography.caption, color: colors.danger },
  movCard: { gap: spacing.xs },
  sectionTitle: { ...typography.subheading, color: colors.text, fontWeight: '700' },
});
