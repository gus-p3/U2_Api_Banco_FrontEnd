import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime, maskAccount } from '@/core/utils/format';
import type { PaymentStatus } from '@/features/payments/domain/entities';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, EmptyState, ErrorState, Loader, ProviderLogo, Screen } from '@/shared/ui';

import { usePaymentHistoryDetail } from './hooks';

function getStatusMeta(status: PaymentStatus) {
  switch (status) {
    case 'APLICADO':
      return {
        title: 'Pago aplicado exitosamente',
        label: 'APLICADO',
        icon: 'checkmark-circle' as const,
        bg: colors.successBg,
        fg: colors.success,
      };
    case 'RECHAZADO':
      return {
        title: 'Pago rechazado',
        label: 'RECHAZADO',
        icon: 'close-circle' as const,
        bg: colors.dangerBg,
        fg: colors.danger,
      };
    case 'POR_CONFIRMAR':
    case 'PENDIENTE':
    default:
      return {
        title: 'Pago en proceso de confirmación',
        label: status === 'POR_CONFIRMAR' ? 'POR CONFIRMAR' : 'PENDIENTE',
        icon: 'time-outline' as const,
        bg: colors.warningBg,
        fg: colors.warning,
      };
  }
}

export function HistoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const idOrUpc = params.id ?? '';
  const detailQuery = usePaymentHistoryDetail(idOrUpc);

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <Loader message="Consultando detalle del pago..." />
      </Screen>
    );
  }

  if (detailQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message={toAppError(detailQuery.error).message}
          onRetry={() => void detailQuery.refetch()}
        />
        <Button title="Volver al historial" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = detailQuery.data;
  if (!item) {
    return (
      <Screen>
        <EmptyState
          title="Pago no encontrado"
          actionLabel="Volver al historial"
          onAction={() => router.replace('/(tabs)/history')}
        />
      </Screen>
    );
  }

  const ui = getStatusMeta(item.status);

  return (
    <Screen refreshing={detailQuery.isRefetching} onRefresh={() => void detailQuery.refetch()}>
      <Card style={styles.card}>
        <View style={styles.badgeWrap}>
          <View style={[styles.iconCircle, { backgroundColor: ui.bg }]}>
            <Ionicons name={ui.icon} size={44} color={ui.fg} />
          </View>
          <View style={[styles.statusPill, { backgroundColor: ui.bg }]}>
            <Text style={[styles.statusPillText, { color: ui.fg }]}>{ui.label}</Text>
          </View>
          <Text style={styles.status}>{ui.title}</Text>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.providerHeader}>
          <ProviderLogo name={item.serviceName} logoUrl={item.logoUrl} size={44} />
          <View style={styles.providerTexts}>
            <Text style={styles.providerService}>{item.serviceName}</Text>
            <Text style={styles.providerProduct}>{item.productName}</Text>
          </View>
        </View>

        <Row
          label="Tipo de operación"
          value={item.kind === 'RECARGA' ? 'Recarga móvil' : 'Pago de servicio'}
        />
        <Row
          label={item.kind === 'RECARGA' ? 'Teléfono abonado' : 'Referencia'}
          value={item.fullDestination}
        />
        <Row label="Cuenta de cargo" value={maskAccount(item.accountNumber)} />
        {item.gatewayCode ? <Row label="Código respuesta GestoPago" value={item.gatewayCode} /> : null}
        {item.authorization ? <Row label="Folio de autorización" value={item.authorization} /> : null}
        {item.transactionId ? (
          <Row label="ID Transacción (idTx)" value={String(item.transactionId)} />
        ) : null}
        {item.upc ? <Row label="Folio UPC" value={item.upc} /> : null}
        <Row label="Fecha y hora" value={formatDateTime(item.createdAt)} />

        {item.productLegend ? (
          <View style={styles.legendBox}>
            <Text style={styles.legendTitle}>Leyenda del producto / proveedor</Text>
            <Text style={styles.legendText}>{item.productLegend}</Text>
          </View>
        ) : null}

        <View style={styles.claimsBox}>
          <Text style={styles.claimsTitle}>¿Dónde puedo reclamar o solicitar una aclaración?</Text>
          <Text style={styles.claimsText}>
            {item.claimsInfo ??
              'Comunícate a la Unidad Especializada de Atención a Usuarios (UNE) de Banco Digital al 800-000-2262 o a aclaraciones@bancodigital.com presentando tu folio UPC y número de autorización. También puedes acudir a CONDUSEF (55 5340 0999 · www.condusef.gob.mx).'}
          </Text>
        </View>

        {item.status === 'POR_CONFIRMAR' || item.status === 'PENDIENTE' ? (
          <Button
            title="Actualizar estado"
            variant="secondary"
            loading={detailQuery.isRefetching}
            onPress={() => void detailQuery.refetch()}
          />
        ) : null}

        <Button title="Volver al historial" onPress={() => router.replace('/(tabs)/history')} />
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
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusPillText: { ...typography.caption, fontWeight: '700' },
  status: { ...typography.heading, color: colors.text, textAlign: 'center' },
  amount: { ...typography.amount, color: colors.primary },
  message: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  providerTexts: { flex: 1 },
  providerService: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  providerProduct: { ...typography.subheading, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowVal: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  legendBox: {
    backgroundColor: colors.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 4,
  },
  legendTitle: { ...typography.caption, color: colors.text, fontWeight: '700' },
  legendText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  claimsBox: {
    backgroundColor: colors.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 4,
  },
  claimsTitle: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  claimsText: { ...typography.caption, color: colors.text, lineHeight: 18 },
});
