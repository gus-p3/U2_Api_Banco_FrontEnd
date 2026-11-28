import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime, maskAccount } from '@/core/utils/format';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, EmptyState, ProviderLogo, Screen } from '@/shared/ui';

import type { PaymentReceipt, PaymentStatus } from '../domain/entities';
import { receiptStore, useRefreshReceipt } from './hooks';

interface StatusPresentation {
  title: string;
  badgeLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  fgColor: string;
  isPending: boolean;
}

function getStatusPresentation(status: PaymentStatus): StatusPresentation {
  switch (status) {
    case 'APLICADO':
      return {
        title: 'Pago aplicado exitosamente',
        badgeLabel: 'APLICADO',
        icon: 'checkmark-circle',
        bgColor: colors.successBg,
        fgColor: colors.success,
        isPending: false,
      };
    case 'RECHAZADO':
      return {
        title: 'Pago rechazado',
        badgeLabel: 'RECHAZADO',
        icon: 'close-circle',
        bgColor: colors.dangerBg,
        fgColor: colors.danger,
        isPending: false,
      };
    case 'POR_CONFIRMAR':
    case 'PENDIENTE':
    default:
      return {
        title: 'Pago en proceso de confirmación',
        badgeLabel: status === 'POR_CONFIRMAR' ? 'POR CONFIRMAR' : 'PENDIENTE',
        icon: 'time-outline',
        bgColor: colors.warningBg,
        fgColor: colors.warning,
        isPending: true,
      };
  }
}

export function ReceiptScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(() => receiptStore.get());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshMutation = useRefreshReceipt();

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

  const ui = getStatusPresentation(receipt.status);
  const lookupKey = receipt.upc ?? (receipt.id ? String(receipt.id) : undefined);

  const handleRefresh = async () => {
    if (!lookupKey) return;
    setRefreshError(null);
    try {
      const updated = await refreshMutation.mutateAsync({
        idOrUpc: lookupKey,
        current: receipt,
      });
      setReceipt(updated);
    } catch (e) {
      setRefreshError(toAppError(e).message);
    }
  };

  return (
    <Screen
      refreshing={refreshMutation.isPending}
      onRefresh={lookupKey ? () => void handleRefresh() : undefined}
    >
      <Card style={styles.card}>
        <View style={styles.badgeWrap}>
          <View style={[styles.iconCircle, { backgroundColor: ui.bgColor }]}>
            <Ionicons name={ui.icon} size={44} color={ui.fgColor} />
          </View>
          <View style={[styles.statusPill, { backgroundColor: ui.bgColor }]}>
            <Text style={[styles.statusPillText, { color: ui.fgColor }]}>{ui.badgeLabel}</Text>
          </View>
          <Text style={styles.status}>{ui.title}</Text>
          <Text style={styles.amount}>{formatCurrency(receipt.amount)}</Text>
          <Text style={styles.message}>
            {receipt.status === 'RECHAZADO'
              ? 'El pago no se pudo procesar, intente de nuevo más tarde'
              : receipt.message}
          </Text>
        </View>

        {ui.isPending ? (
          <View style={styles.pendingAlert} accessibilityRole="alert">
            <Text style={styles.pendingAlertTitle}>Operación aún no confirmada como aplicada</Text>
            <Text style={styles.pendingAlertText}>
              El proveedor GestoPago está procesando la confirmación de esta transacción. Puedes
              actualizar el estado desde aquí usando tu folio UPC.
            </Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.providerHeader}>
          <ProviderLogo name={receipt.serviceName} logoUrl={receipt.logoUrl} size={40} />
          <View style={styles.providerTexts}>
            <Text style={styles.providerService}>{receipt.serviceName}</Text>
            <Text style={styles.providerProduct}>{receipt.productName}</Text>
          </View>
        </View>

        <Row
          label="Operación"
          value={receipt.kind === 'RECARGA' ? 'Recarga móvil' : 'Pago de servicio'}
        />
        <Row
          label={receipt.kind === 'RECARGA' ? 'Teléfono abonado' : 'Referencia'}
          value={receipt.destination}
        />
        <Row label="Cuenta de cargo" value={maskAccount(receipt.accountNumber)} />
        {receipt.gatewayCode ? (
          <Row label="Código respuesta GestoPago" value={receipt.gatewayCode} />
        ) : null}
        {receipt.authorization ? (
          <Row label="Folio de autorización" value={receipt.authorization} />
        ) : null}
        {receipt.transactionId ? (
          <Row label="ID Transacción (idTx)" value={String(receipt.transactionId)} />
        ) : null}
        {receipt.upc ? <Row label="Folio UPC" value={receipt.upc} /> : null}
        <Row label="Fecha y hora" value={formatDateTime(receipt.createdAt)} />

        {receipt.emailSent ? (
          <View style={styles.emailNotice}>
            <Ionicons name="mail-outline" size={18} color={colors.success} />
            <Text style={styles.emailNoticeText}>
              Enviamos una copia de este ticket a tu correo electrónico registrado.
            </Text>
          </View>
        ) : null}

        {receipt.productLegend ? (
          <View style={styles.legendBox}>
            <Text style={styles.legendTitle}>Leyenda del producto / proveedor</Text>
            <Text style={styles.legendText}>{receipt.productLegend}</Text>
          </View>
        ) : null}

        <View style={styles.claimsBox}>
          <Text style={styles.claimsTitle}>¿Dónde puedo reclamar o solicitar una aclaración?</Text>
          <Text style={styles.claimsText}>
            {receipt.claimsInfo ??
              'Comunícate a la Unidad Especializada de Atención a Usuarios (UNE) de Banco Digital al 800-000-2262 o a aclaraciones@bancodigital.com presentando tu folio UPC y número de autorización. También puedes acudir a CONDUSEF (55 5340 0999 · www.condusef.gob.mx).'}
          </Text>
        </View>

        {refreshError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {refreshError}
          </Text>
        ) : null}

        {ui.isPending && lookupKey ? (
          <Button
            title="Actualizar estado del pago"
            variant="secondary"
            loading={refreshMutation.isPending}
            onPress={() => void handleRefresh()}
          />
        ) : null}

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
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: '700',
  },
  status: { ...typography.heading, color: colors.text, textAlign: 'center' },
  amount: { ...typography.amount, color: colors.primary },
  message: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  pendingAlert: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingAlertTitle: { ...typography.subheading, color: colors.warning },
  pendingAlertText: { ...typography.caption, color: colors.text },
  rejectedAlert: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  rejectedAlertTitle: { ...typography.subheading, color: colors.danger },
  rejectedAlertText: { ...typography.caption, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
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
  emailNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  emailNoticeText: { ...typography.caption, color: colors.success, fontWeight: '600', flex: 1 },
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
  error: { ...typography.caption, color: colors.danger },
});
