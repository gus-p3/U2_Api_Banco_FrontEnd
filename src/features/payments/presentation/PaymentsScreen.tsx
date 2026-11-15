import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, maskAccount } from '@/core/utils/format';
import { useAccounts } from '@/features/accounts/presentation/hooks';
import { isBiometricConfirmationAvailable } from '@/features/auth/presentation/authActions';
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
  ProviderLogo,
  Screen,
} from '@/shared/ui';

import type { PaymentKind, Product, ReferenceValidationResult } from '../domain/entities';
import { receiptStore, usePay, useProducts, useValidateReference } from './hooks';

const PAGE_STEP = 20;

export function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string; serviceId?: string }>();
  const [kind, setKind] = useState<PaymentKind>('RECARGA');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [referenceValidation, setReferenceValidation] =
    useState<ReferenceValidationResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const productsQuery = useProducts();
  const { accounts } = useAccounts();
  const validateRefMutation = useValidateReference();
  const payMutation = usePay();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void isBiometricConfirmationAvailable().then(setBiometricAvailable);
    }
  }, []);

  useEffect(() => {
    if (params.tab === 'SERVICIO' || params.tab === 'RECARGA') {
      setKind(params.tab);
      setSelectedProduct(null);
      setReferenceValidation(null);
      setVisibleCount(PAGE_STEP);
    }
  }, [params.tab]);

  useEffect(() => {
    if (!params.productId || !productsQuery.data) return;
    const match = productsQuery.data.find(
      (p) =>
        String(p.idProducto) === String(params.productId) &&
        (!params.serviceId || String(p.idServicio) === String(params.serviceId)),
    );
    if (match) {
      if (match.kind === 'RECARGA' || match.kind === 'SERVICIO') {
        setKind(match.kind);
      }
      setSelectedProduct(match);
      setReferenceValidation(null);
    }
  }, [params.productId, params.serviceId, productsQuery.data]);

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

  const handleValidateReference = async () => {
    setFormError(null);
    setReferenceValidation(null);
    if (!selectedProduct) {
      setFormError('Selecciona un producto del catálogo.');
      return;
    }
    const cleanRef = reference.trim();
    if (!cleanRef) {
      setFormError('Ingresa la referencia de pago para validarla.');
      return;
    }
    const parsedAmount = amount.trim() ? Number(amount) : selectedProduct.price;
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setFormError('Ingresa un monto válido mayor a $0.00 antes de validar la referencia.');
      return;
    }
    try {
      const result = await validateRefMutation.mutateAsync({
        idServicio: selectedProduct.idServicio,
        idProducto: selectedProduct.idProducto,
        reference: cleanRef,
        amount: parsedAmount,
      });
      setReferenceValidation(result);
      if (result.valid && result.amountDue && !amount.trim()) {
        setAmount(String(result.amountDue));
      }
      if (!result.valid) {
        setFormError(result.message);
      }
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  };

  const canContinue =
    kind === 'RECARGA' || (kind === 'SERVICIO' && Boolean(referenceValidation?.valid));

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
      if (!referenceValidation?.valid) {
        setFormError('Debes validar la referencia antes de continuar con el pago.');
        return;
      }
    }
    setConfirmPassword('');
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const handleConfirmPay = async (mode: 'PASSWORD' | 'BIOMETRIC') => {
    if (!selectedProduct) return;
    setConfirmError(null);
    setFormError(null);
    if (mode === 'PASSWORD' && !confirmPassword.trim()) {
      setConfirmError('Ingresa tu contraseña para confirmar el pago.');
      return;
    }
    try {
      const receipt = await payMutation.mutateAsync({
        accountNumber: selectedAccount,
        product: selectedProduct,
        kind,
        phone: kind === 'RECARGA' ? phone.trim() : undefined,
        reference: kind === 'SERVICIO' ? reference.trim() : undefined,
        amount: kind === 'SERVICIO' ? Number(amount) : undefined,
        referenceValidated: kind === 'SERVICIO' ? Boolean(referenceValidation?.valid) : true,
        confirmationPassword: mode === 'PASSWORD' ? confirmPassword : undefined,
        useBiometricConfirmation: mode === 'BIOMETRIC',
      });
      setConfirmOpen(false);
      setConfirmPassword('');
      receiptStore.set(receipt);
      router.push('/payment/receipt');
    } catch (e) {
      setConfirmError(toAppError(e).message);
    }
  };

  const effectiveAmount =
    kind === 'RECARGA' ? (selectedProduct?.price ?? 0) : Number(amount) || 0;

  return (
    <Screen refreshing={productsQuery.isRefetching} onRefresh={() => void productsQuery.refetch()}>
      <Text style={styles.title}>Pagos y recargas</Text>

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
                setReferenceValidation(null);
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
          onChangeText={(val) => {
            setSearch(val);
            setVisibleCount(PAGE_STEP);
          }}
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
            description={
              search.trim()
                ? 'Prueba con otro término de búsqueda.'
                : 'El catálogo está vacío en este momento.'
            }
            actionLabel="Reintentar"
            onAction={() => void productsQuery.refetch()}
          />
        ) : (
          <View style={styles.productList}>
            {filteredProducts.slice(0, visibleCount).map((p) => {
              const isSelected =
                selectedProduct?.idProducto === p.idProducto &&
                selectedProduct?.idServicio === p.idServicio;
              const subtitleParts = [
                p.category ?? 'GestoPago',
                p.description ?? (p.referenceType ? `Ref: ${p.referenceType}` : undefined),
                `ID ${p.idServicio}/${p.idProducto}`,
              ].filter(Boolean);
              return (
                <View
                  key={`${p.idServicio}-${p.idProducto}-${p.id}`}
                  style={[styles.productRow, isSelected && styles.productSelected]}
                >
                  <ListItem
                    leading={<ProviderLogo name={p.serviceName} logoUrl={p.logoUrl} size={40} />}
                    title={`${p.serviceName} · ${p.name}`}
                    subtitle={subtitleParts.join(' · ')}
                    trailing={p.price ? formatCurrency(p.price) : 'Monto abierto'}
                    onPress={() => {
                      setSelectedProduct(p);
                      setReferenceValidation(null);
                      setFormError(null);
                    }}
                  />
                </View>
              );
            })}
            {visibleCount < filteredProducts.length ? (
              <Button
                title={`Mostrar más (${filteredProducts.length - visibleCount} restantes)`}
                variant="secondary"
                onPress={() => setVisibleCount((c) => c + PAGE_STEP)}
              />
            ) : null}
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
                onChangeText={(val) => {
                  setReference(val);
                  if (referenceValidation) setReferenceValidation(null);
                  setFormError(null);
                }}
                hint={
                  selectedProduct.referenceType
                    ? `Formato esperado: ${selectedProduct.referenceType}`
                    : undefined
                }
              />
              <Input
                label="Monto a pagar (MXN)"
                placeholder="150.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  if (referenceValidation) setReferenceValidation(null);
                  setFormError(null);
                }}
              />

              <Button
                title={
                  referenceValidation?.valid
                    ? 'Referencia validada ✓ (volver a validar)'
                    : 'Validar referencia'
                }
                variant="secondary"
                loading={validateRefMutation.isPending}
                onPress={() => void handleValidateReference()}
              />

              {referenceValidation ? (
                <View
                  style={[
                    styles.validationBox,
                    referenceValidation.valid
                      ? styles.validationBoxSuccess
                      : styles.validationBoxError,
                  ]}
                  accessibilityRole="summary"
                >
                  <Text style={styles.validationTitle}>
                    {referenceValidation.valid
                      ? 'Referencia válida en GestoPago'
                      : 'Referencia inválida'}
                  </Text>
                  <Text style={styles.validationText}>{referenceValidation.message}</Text>
                  {referenceValidation.valid ? (
                    <>
                      <Text style={styles.validationMeta}>
                        Servicio: {referenceValidation.serviceName ?? selectedProduct.serviceName} ·{' '}
                        {referenceValidation.productName ?? selectedProduct.name}
                      </Text>
                      {referenceValidation.description ? (
                        <Text style={styles.validationMeta}>
                          Detalle: {referenceValidation.description}
                        </Text>
                      ) : null}
                      <Text style={styles.validationMeta}>
                        Titular:{' '}
                        {referenceValidation.holderName ??
                          'No proporcionado por el proveedor antes del pago'}
                      </Text>
                      {referenceValidation.amountDue ? (
                        <Text style={styles.validationMeta}>
                          Importe reportado: {formatCurrency(referenceValidation.amountDue)}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}

          <Button
            title="Continuar y revisar pago"
            disabled={!canContinue}
            loading={payMutation.isPending}
            onPress={handlePrepareConfirm}
          />
        </Card>
      ) : null}

      <AppModal
        visible={confirmOpen}
        title="Resumen y confirmación de pago"
        onRequestClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button
              title="Confirmar con contraseña y pagar"
              loading={payMutation.isPending}
              onPress={() => void handleConfirmPay('PASSWORD')}
            />
            {Platform.OS !== 'web' && biometricAvailable ? (
              <Button
                title="Autorizar con huella digital"
                variant="secondary"
                loading={payMutation.isPending}
                onPress={() => void handleConfirmPay('BIOMETRIC')}
              />
            ) : null}
            <Button title="Cancelar" variant="ghost" onPress={() => setConfirmOpen(false)} />
          </>
        }
      >
        {selectedProduct ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryHeader}>
              <ProviderLogo
                name={selectedProduct.serviceName}
                logoUrl={selectedProduct.logoUrl}
                size={40}
              />
              <View style={styles.summaryHeaderTexts}>
                <Text style={styles.summaryService}>{selectedProduct.serviceName}</Text>
                <Text style={styles.summaryProduct}>{selectedProduct.name}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {kind === 'RECARGA' ? 'Teléfono destino' : 'Referencia validada'}
              </Text>
              <Text style={styles.summaryValue}>
                {kind === 'RECARGA' ? phone.trim() : reference.trim()}
              </Text>
            </View>
            {kind === 'SERVICIO' && referenceValidation?.valid ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estado validación</Text>
                <Text style={styles.summaryValue}>Válida ({referenceValidation.serviceName})</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cuenta de cargo</Text>
              <Text style={styles.summaryValue}>{maskAccount(selectedAccount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Importe</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(effectiveAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Comisión al cliente</Text>
              <Text style={styles.summaryValue}>{formatCurrency(0)} (absorbida por el banco)</Text>
            </View>
          </View>
        ) : null}

        <Input
          label="Contraseña de tu cuenta"
          placeholder="Ingresa tu contraseña para confirmar"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {confirmError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {confirmError}
          </Text>
        ) : null}
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.primary },
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
  validationBox: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
  },
  validationBoxSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  validationBoxError: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  validationTitle: { ...typography.subheading, color: colors.text },
  validationText: { ...typography.body, color: colors.text },
  validationMeta: { ...typography.caption, color: colors.textMuted },
  summaryBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryHeaderTexts: { flex: 1 },
  summaryService: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  summaryProduct: { ...typography.subheading, color: colors.primary },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
  summaryAmount: { ...typography.subheading, color: colors.primary, fontWeight: '700' },
  error: { ...typography.caption, color: colors.danger },
});
