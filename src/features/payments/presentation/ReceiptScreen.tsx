import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency, formatDateTime, maskAccount } from '@/core/utils/format';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, EmptyState, Screen } from '@/shared/ui';

import { receiptStore } from './hooks';

export function ReceiptScreen() {
  const router = useRouter();
  const receipt = receiptStore.get();

  if (!receipt) {
    return (
      <Screen>
        <EmptyState
          title="No hay comprobante reciente"
          actionLabel="Ir a pagos"
          onAction={() => router.replace('/(tabs)/payments')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <View style={styles.badgeWrap}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: receipt.applied ? colors.successBg : colors.warningBg },
            ]}
          >
            <Ionicons
              name={receipt.applied ? 'checkmark-circle' : 'time-outline'}
              size={44}
              color={receipt.applied ? colors.success : colors.warning}
            />
          </View>
          <Text style={styles.status}>
            {receipt.applied ? 'Pago aplicado' : `Estado: ${receipt.status}`}
          </Text>
          <Text style={styles.amount}>{formatCurrency(receipt.amount)}</Text>
          <Text style={styles.message}>{receipt.message}</Text>
        </View>

        <View style={styles.divider} />

        <Row
          label="Operación"
          value={receipt.kind === 'RECARGA' ? 'Recarga móvil' : 'Pago de servicio'}
        />
        <Row label="Compañía / Producto" value={`${receipt.serviceName} · ${receipt.productName}`} />
        <Row
          label={receipt.kind === 'RECARGA' ? 'Teléfono abonado' : 'Referencia'}
          value={receipt.destination}
        />
        <Row label="Cuenta de cargo" value={maskAccount(receipt.accountNumber)} />
        {receipt.authorization ? <Row label="Autorización" value={receipt.authorization} /> : null}
        {receipt.transactionId ? (
          <Row label="ID Transacción" value={String(receipt.transactionId)} />
        ) : null}
        {receipt.upc ? <Row label="Folio UPC" value={receipt.upc} /> : null}
        <Row label="Fecha y hora" value={formatDateTime(receipt.createdAt)} />

        <Button
          title="Volver al inicio"
          onPress={() => {
            receiptStore.clear();
            router.replace('/(tabs)');
          }}
        />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  badgeWrap: { alignItems: 'center', gap: spacing.xs },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { ...typography.subheading, color: colors.primary },
  amount: { ...typography.amount, color: colors.primary },
  message: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowVal: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
});
