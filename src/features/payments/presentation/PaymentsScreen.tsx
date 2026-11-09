import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, maskAccount } from '@/core/utils/format';
import { useAccounts } from '@/features/accounts/presentation/hooks';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
  AppModal,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListItem,
  Loader,
  Screen,
} from '@/shared/ui';

import type { PaymentKind, Product } from '../domain/entities';
import { isPaymentsSupported, receiptStore, usePay, useProducts } from './hooks';

export function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [kind, setKind] = useState<PaymentKind>('RECARGA');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const productsQuery = useProducts();
  const { accounts } = useAccounts();
  const payMutation = usePay();
  const supported = isPaymentsSupported();

  useEffect(() => {
    if (params.tab === 'SERVICIO' || params.tab === 'RECARGA') {
      setKind(params.tab);
      setSelectedProduct(null);
    }
  }, [params.tab]);

  useEffect(() => {
    if (!selectedAccount && accounts[0]) {
      setSelectedAccount(accounts[0].number);
    }
  }, [accounts, selectedAccount]);

  const filteredProducts = useMemo(() => {
    const list = (productsQuery.data ?? []).filter((p) => p.kind === kind);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.serviceName.toLowerCase().includes(q),
    );
  }, [productsQuery.data, kind, search]);

  const handlePrepareConfirm = () => {
    setFormError(null);
    if (!selectedProduct) {
      setFormError('Selecciona un producto del catálogo.');
      return;
    }
    if (!selectedAccount) {
      setFormError('Selecciona una cuenta de cargo.');
      return;
    }
    if (kind === 'RECARGA' && !/^[0-9]{10}$/.test(phone.trim())) {
      setFormError('Ingresa un número telefónico válido de 10 dígitos.');
      return;
    }
    if (kind === 'SERVICIO') {
      if (!reference.trim()) {
        setFormError('Ingresa la referencia de pago.');
        return;
      }
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) {
        setFormError('Ingresa un monto válido mayor a $0.00.');
        return;
      }
    }
    setConfirmOpen(true);
  };

  const handleConfirmPay = async () => {
    if (!selectedProduct) return;
    setFormError(null);
    try {
      const receipt = await payMutation.mutateAsync({
        accountNumber: selectedAccount,
        product: selectedProduct,
        kind,
        phone: kind === 'RECARGA' ? phone.trim() : undefined,
        reference: kind === 'SERVICIO' ? reference.trim() : undefined,
        amount: kind === 'SERVICIO' ? Number(amount) : undefined,
      });
      setConfirmOpen(false);
      receiptStore.set(receipt);
      router.push('/payment/receipt');
    } catch (e) {
      setConfirmOpen(false);
      setFormError(toAppError(e).message);
    }
  };

  return (
    <Screen refreshing={productsQuery.isRefetching} onRefresh={() => void productsQuery.refetch()}>
      <Text style={styles.title}>Pagos y recargas</Text>

      {!supported ? (
        <View style={styles.webBanner} accessibilityRole="alert">
          <Text style={styles.webBannerTitle}>Operación disponible solo en la app Android</Text>
          <Text style={styles.webBannerText}>
            Por seguridad bancaria, el servidor exige firma biométrica de huella digital para autorizar
            pagos y recargas. En web puedes explorar el catálogo de productos.
          </Text>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {(['RECARGA', 'SERVICIO'] as const).map((k) => {
          const active = kind === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setKind(k);
                setSelectedProduct(null);
                setFormError(null);
              }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {k === 'RECARGA' ? 'Recargas móviles' : 'Pago de servicios'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.card}>
        <Input
          label="Buscar compañía o producto"
          placeholder="Ej. Telcel, CFE, Izzi, Totalplay..."
          value={search}
          onChangeText={setSearch}
        />

        {productsQuery.isLoading ? (
          <Loader message="Consultando catálogo GestoPago..." />
        ) : productsQuery.isError ? (
          <ErrorState
            message={toAppError(productsQuery.error).message}
            onRetry={() => void productsQuery.refetch()}
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No se encontraron productos"
            description="Prueba con otro término de búsqueda."
          />
        ) : (
          <View style={styles.productList}>
            {filteredProducts.slice(0, 12).map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              return (
                <View key={p.id} style={[styles.productRow, isSelected && styles.productSelected]}>
                  <ListItem
                    icon={kind === 'RECARGA' ? 'phone-portrait-outline' : 'receipt-outline'}
                    title={`${p.serviceName} · ${p.name}`}
                    subtitle={p.referenceType ? `Referencia: ${p.referenceType}` : 'GestoPago'}
                    trailing={p.price ? formatCurrency(p.price) : 'Monto abierto'}
                    onPress={() => setSelectedProduct(p)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {selectedProduct ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Datos para: {selectedProduct.serviceName} — {selectedProduct.name}
          </Text>

          <Text style={styles.label}>Cuenta de cargo</Text>
          <View style={styles.accountChips}>
            {accounts.map((acc) => {
              const active = selectedAccount === acc.number;
              return (
                <Pressable
                  key={acc.number}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedAccount(acc.number)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {maskAccount(acc.number)} ({formatCurrency(acc.balance)})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {kind === 'RECARGA' ? (
            <Input
              label="Número de teléfono (10 dígitos)"
              placeholder="5512345678"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              hint={
                selectedProduct.price
                  ? `Monto fijo de la recarga: ${formatCurrency(selectedProduct.price)} (sin comisión para ti)`
                  : undefined
              }
            />
          ) : (
            <>
              <Input
                label="Referencia o número de contrato"
                placeholder="Captura los dígitos de tu recibo"
                value={reference}
                onChangeText={setReference}
              />
              <Input
                label="Monto a pagar (MXN)"
                placeholder="150.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </>
          )}

          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}

          <Button
            title={supported ? 'Continuar y revisar pago' : 'Pago disponible solo en Android'}
            disabled={!supported}
            loading={payMutation.isPending}
            onPress={handlePrepareConfirm}
          />
        </Card>
      ) : null}

      <AppModal
        visible={confirmOpen}
        title="Confirmar operación"
        message={
          selectedProduct
            ? `Vas a pagar ${selectedProduct.serviceName} (${selectedProduct.name}) con cargo a la cuenta ${maskAccount(selectedAccount)} por ${formatCurrency(
                kind === 'RECARGA' ? selectedProduct.price : Number(amount),
              )}. Se solicitará tu huella digital.`
            : ''
        }
        onRequestClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button
              title="Autorizar con huella y pagar"
              loading={payMutation.isPending}
              onPress={() => void handleConfirmPay()}
            />
            <Button title="Cancelar" variant="ghost" onPress={() => setConfirmOpen(false)} />
          </>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.primary },
  webBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  webBannerTitle: { ...typography.subheading, color: colors.warning },
  webBannerText: { ...typography.caption, color: colors.text },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.subheading, color: colors.primary },
  tabTextActive: { color: colors.textOnPrimary },
  card: { gap: spacing.md },
  productList: { gap: spacing.xs },
  productRow: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  productSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  sectionTitle: { ...typography.subheading, color: colors.primary },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  accountChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  error: { ...typography.caption, color: colors.danger },
});
