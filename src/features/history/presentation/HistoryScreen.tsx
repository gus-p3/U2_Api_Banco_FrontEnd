import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime } from '@/core/utils/format';
import type { PaymentStatus } from '@/features/payments/domain/entities';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  ProviderLogo,
  Screen,
} from '@/shared/ui';

import { usePaymentHistory } from './hooks';

const STATUS_OPTIONS: Array<{ label: string; value?: PaymentStatus }> = [
  { label: 'Todos', value: undefined },
  { label: 'Aplicados', value: 'APLICADO' },
  { label: 'Por confirmar', value: 'POR_CONFIRMAR' },
  { label: 'Rechazados', value: 'RECHAZADO' },
];

function badgeForStatus(status: PaymentStatus) {
  switch (status) {
    case 'APLICADO':
      return { label: 'APLICADO', bg: colors.successBg, fg: colors.success };
    case 'RECHAZADO':
      return { label: 'RECHAZADO', bg: colors.dangerBg, fg: colors.danger };
    case 'POR_CONFIRMAR':
    case 'PENDIENTE':
    default:
      return {
        label: status === 'POR_CONFIRMAR' ? 'POR CONFIRMAR' : 'PENDIENTE',
        bg: colors.warningBg,
        fg: colors.warning,
      };
  }
}

export function HistoryScreen() {
  const router = useRouter();
  const [estado, setEstado] = useState<PaymentStatus | undefined>(undefined);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);

  const historyQuery = usePaymentHistory({
    estado,
    desde: desde.trim() || undefined,
    hasta: hasta.trim() || undefined,
    page,
    size: 10,
  });

  const data = historyQuery.data;
  const items = data?.items ?? [];

  return (
    <Screen refreshing={historyQuery.isRefetching} onRefresh={() => void historyQuery.refetch()}>
      <Text style={styles.title}>Historial de pagos</Text>
      <Text style={styles.subtitle}>
        Consulta tus recargas y pagos de servicios realizados desde tu cuenta.
      </Text>

      <Card style={styles.filterCard}>
        <Text style={styles.filterLabel}>Filtrar por estado</Text>
        <View style={styles.chipsRow}>
          {STATUS_OPTIONS.map((opt) => {
            const active = estado === opt.value;
            return (
              <Pressable
                key={opt.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setEstado(opt.value);
                  setPage(0);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Input
              label="Desde (AAAA-MM-DD)"
              placeholder="2026-01-01"
              value={desde}
              onChangeText={(val) => {
                setDesde(val);
                setPage(0);
              }}
            />
          </View>
          <View style={styles.dateCol}>
            <Input
              label="Hasta (AAAA-MM-DD)"
              placeholder="2026-12-31"
              value={hasta}
              onChangeText={(val) => {
                setHasta(val);
                setPage(0);
              }}
            />
          </View>
        </View>
      </Card>

      {historyQuery.isLoading ? (
        <Loader message="Consultando tu historial de pagos..." />
      ) : historyQuery.isError ? (
        <ErrorState
          message={toAppError(historyQuery.error).message}
          onRetry={() => void historyQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin pagos registrados"
          description="No se encontraron pagos con los filtros seleccionados."
          actionLabel="Ir a pagos"
          onAction={() => router.push('/(tabs)/payments')}
        />
      ) : (
        <View style={styles.listContainer}>
          {items.map((item) => {
            const badge = badgeForStatus(item.status);
            const folio = item.authorization ?? (item.transactionId ? String(item.transactionId) : item.upc);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de ${item.serviceName} ${item.productName}`}
                onPress={() => router.push(`/payment/${item.id}`)}
              >
                <Card style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <ProviderLogo name={item.serviceName} logoUrl={item.logoUrl} size={42} />
                    <View style={styles.itemTexts}>
                      <Text style={styles.serviceName}>
                        {item.serviceName} · {item.productName}
                      </Text>
                      <Text style={styles.metaText}>
                        {item.kind === 'RECARGA' ? 'Tel: ' : 'Ref: '}
                        {item.maskedDestination}
                      </Text>
                      <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
                    </View>
                    <View style={styles.rightCol}>
                      <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.folioRow}>
                    <Text style={styles.folioText}>
                      Folio / UPC: {folio ?? item.upc ?? 'N/D'}
                    </Text>
                    <Text style={styles.detailLink}>Ver detalle →</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}

          {data && data.totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <Button
                title="Anterior"
                variant="secondary"
                disabled={page <= 0}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
              />
              <Text style={styles.pageIndicator}>
                Página {data.page + 1} de {data.totalPages} ({data.totalElements} pagos)
              </Text>
              <Button
                title="Siguiente"
                variant="secondary"
                disabled={data.last}
                onPress={() => setPage((p) => p + 1)}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.primary },
  subtitle: { ...typography.body, color: colors.textMuted },
  filterCard: { gap: spacing.sm },
  filterLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
  listContainer: { gap: spacing.md },
  itemCard: { gap: spacing.xs },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemTexts: { flex: 1, gap: 2 },
  serviceName: { ...typography.subheading, color: colors.text },
  metaText: { ...typography.caption, color: colors.textMuted },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  amount: { ...typography.subheading, color: colors.primary, fontWeight: '700' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  badgeText: { ...typography.caption, fontSize: 11, fontWeight: '700' },
  folioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  folioText: { ...typography.caption, color: colors.textMuted },
  detailLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageIndicator: { ...typography.caption, color: colors.text, fontWeight: '600' },
});

