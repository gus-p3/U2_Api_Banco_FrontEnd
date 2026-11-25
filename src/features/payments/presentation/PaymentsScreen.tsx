import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, maskAccount } from '@/core/utils/format';
import {
  validatePaymentAmount,
  validatePhone10,
  validateSearchQuery,
  validateServiceReference,
} from '@/core/validation/validators';
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
import { isPaymentsSupported, receiptStore, usePay, useProducts, useValidateReference } from './hooks';

const PAGE_STEP = 20;

export function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string; serviceId?: string }>();
  const paymentsAllowed = isPaymentsSupported();

  const [kind, setKind] = useState<PaymentKind>('RECARGA');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [reference, setReference] = useState('');
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [referenceValidation, setReferenceValidation] =
    useState<ReferenceValidationResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const productsQuery = useProducts(paymentsAllowed);
  const { accounts } = useAccounts();
  const validateRefMutation = useValidateReference();
  const payMutation = usePay();

  useEffect(() => {
    if (paymentsAllowed) {
      void isBiometricConfirmationAvailable().then(setBiometricAvailable);
    }
  }, [paymentsAllowed]);

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
      if (match.kind === 'SERVICIO' && match.price && match.price > 0) {
        setAmount(String(match.price));
      }
    }
  }, [params.productId, params.serviceId, productsQuery.data]);

  useEffect(() => {
    if (!selectedAccount && accounts[0]) {
      const firstActive = accounts.find((a) => a.status === 'ACTIVA') ?? accounts[0];
      setSelectedAccount(firstActive.number);
    }
  }, [accounts, selectedAccount]);

  const selectedAccountObj = useMemo(
    () => accounts.find((a) => a.number === selectedAccount),
    [accounts, selectedAccount],
  );

  // Validaciones en tiempo real de todos los campos
  const searchError = validateSearchQuery(search, 60);

  const effectiveAmount =
    kind === 'RECARGA' ? (selectedProduct?.price ?? 0) : Number(amount) || 0;

  const accountError = useMemo(() => {
    if (!selectedAccount) return 'Selecciona una cuenta de cargo.';
    if (!/^[0-9]{10}$/.test(selectedAccount)) return 'El número de cuenta no es válido.';
    if (selectedAccountObj && selectedAccountObj.status !== 'ACTIVA') {
      return 'La cuenta seleccionada se encuentra inactiva para realizar pagos.';
    }
    if (
      selectedAccountObj &&
      effectiveAmount > 0 &&
      selectedAccountObj.balance < effectiveAmount
    ) {
      return `Saldo insuficiente en la cuenta (${formatCurrency(selectedAccountObj.balance)} disponible).`;
    }
    return undefined;
  }, [selectedAccount, selectedAccountObj, effectiveAmount]);

  const phoneError = useMemo(() => {
    if (kind !== 'RECARGA') return undefined;
    return validatePhone10(phone);
  }, [kind, phone]);

  const referenceError = useMemo(() => {
    if (kind !== 'SERVICIO') return undefined;
    return validateServiceReference(reference, selectedProduct);
  }, [kind, reference, selectedProduct]);

  const amountError = useMemo(() => {
    if (kind !== 'SERVICIO') return undefined;
    return validatePaymentAmount(amount, {
      maxBalance: selectedAccountObj?.balance,
      fixedPrice: selectedProduct?.price,
    });
  }, [kind, amount, selectedAccountObj?.balance, selectedProduct?.price]);

  const filteredProducts = useMemo(() => {
    const list = (productsQuery.data ?? []).filter((p) => p.kind === kind);
    if (searchError) return list;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.serviceName.toLowerCase().includes(q),
    );
  }, [productsQuery.data, kind, search, searchError]);

  // En plataforma Web los pagos están estrictamente prohibidos: solo app móvil con huella digital
  if (!paymentsAllowed) {
    return (
      <Screen>
        <Text style={styles.title}>Pagos y recargas</Text>
        <Card style={styles.webRestrictionCard}>
          <View style={styles.webBadgeCircle}>
            <Ionicons name="finger-print" size={42} color={colors.primary} />
          </View>
          <Text style={styles.webRestrictionTitle}>
            Pagos exclusivos en la aplicación móvil con huella digital
          </Text>
          <Text style={styles.webRestrictionBody}>
            Por tu seguridad bancaria, la versión web es únicamente de consulta. Todas las recargas
            y pagos de servicios vía GestoPago requieren verificación biométrica con tu huella
            digital desde la aplicación móvil.
          </Text>
          <View style={styles.webActions}>
            <Button
              title="Consultar catálogo de servicios"
              variant="secondary"
              onPress={() => router.push('/(tabs)/catalog')}
            />
            <Button
              title="Ver historial de pagos"
              variant="outline"
              onPress={() => router.push('/(tabs)/history')}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  const handleValidateReference = async () => {
    setFormError(null);
    setReferenceValidation(null);
    setReferenceTouched(true);
    if (amount.trim()) {
      setAmountTouched(true);
    }

    if (!selectedProduct) {
      setFormError('Selecciona un producto del catálogo.');
      return;
    }
    if (referenceError) {
      setFormError(referenceError);
      return;
    }

    const parsedAmount = amount.trim() ? Number(amount) : selectedProduct.price;
    if (amount.trim()) {
      const preAmountErr = validatePaymentAmount(amount, {
        fixedPrice: selectedProduct.price,
      });
      if (preAmountErr) {
        setFormError(preAmountErr);
        return;
      }
    }

    try {
      const result = await validateRefMutation.mutateAsync({
        idServicio: selectedProduct.idServicio,
        idProducto: selectedProduct.idProducto,
        reference: reference.trim(),
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
    Boolean(selectedProduct) &&
    !accountError &&
    (kind === 'RECARGA'
      ? !phoneError
      : !referenceError && !amountError && Boolean(referenceValidation?.valid));

  const handlePrepareConfirm = async () => {
    setFormError(null);
    setPhoneTouched(true);
    setReferenceTouched(true);
    setAmountTouched(true);

    if (!selectedProduct) {
      setFormError('Selecciona un producto del catálogo.');
      return;
    }
    if (accountError) {
      setFormError(accountError);
      return;
    }
    if (kind === 'RECARGA' && phoneError) {
      setFormError(phoneError);
      return;
    }
    if (kind === 'SERVICIO') {
      if (referenceError) {
        setFormError(referenceError);
        return;
      }
      if (amountError) {
        setFormError(amountError);
        return;
      }
      if (!referenceValidation?.valid) {
        setFormError('Debes validar la referencia antes de continuar con el pago.');
        return;
      }
    }

    const bioReady = await isBiometricConfirmationAvailable();
    setBiometricAvailable(bioReady);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const handleConfirmPayWithFingerprint = async () => {
    if (!selectedProduct) return;
    setConfirmError(null);
    setFormError(null);
    try {
      const receipt = await payMutation.mutateAsync({
        accountNumber: selectedAccount,
        product: selectedProduct,
        kind,
        phone: kind === 'RECARGA' ? phone.trim() : undefined,
        reference: kind === 'SERVICIO' ? reference.trim() : undefined,
        amount: kind === 'SERVICIO' ? Number(amount) : undefined,
        referenceValidated: kind === 'SERVICIO' ? Boolean(referenceValidation?.valid) : true,
        useBiometricConfirmation: true,
      });
      setConfirmOpen(false);
      receiptStore.set(receipt);
      router.push('/payment/receipt');
    } catch (e) {
      setConfirmError(toAppError(e).message);
    }
  };

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
                setPhoneTouched(false);
                setReferenceTouched(false);
                setAmountTouched(false);
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
          maxLength={60}
          value={search}
          onChangeText={(val) => {
            setSearch(val);
            setVisibleCount(PAGE_STEP);
          }}
          error={searchError}
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
                      if (p.kind === 'SERVICIO' && p.price && p.price > 0) {
                        setAmount(String(p.price));
                      }
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
          {accountError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {accountError}
            </Text>
          ) : null}

          {kind === 'RECARGA' ? (
            <Input
              label="Número de teléfono (10 dígitos)"
              placeholder="5512345678"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onBlur={() => setPhoneTouched(true)}
              onChangeText={(val) => {
                const digitsOnly = val.replace(/\s+/g, '');
                setPhone(digitsOnly);
                setFormError(null);
              }}
              error={phoneTouched || phone.length > 0 ? phoneError : undefined}
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
                maxLength={60}
                value={reference}
                onBlur={() => setReferenceTouched(true)}
                onChangeText={(val) => {
                  setReference(val);
                  if (referenceValidation) setReferenceValidation(null);
                  setFormError(null);
                }}
                error={referenceTouched || reference.length > 0 ? referenceError : undefined}
                hint={
                  selectedProduct.referenceType
                    ? `Formato esperado: ${selectedProduct.referenceType}`
                    : 'Entre 4 y 60 caracteres sin espacios'
                }
              />
              <Input
                label="Monto a pagar (MXN)"
                placeholder="150.00"
                keyboardType="decimal-pad"
                maxLength={13}
                value={amount}
                onBlur={() => setAmountTouched(true)}
                onChangeText={(val) => {
                  setAmount(val);
                  if (referenceValidation) setReferenceValidation(null);
                  setFormError(null);
                }}
                error={amountTouched || amount.length > 0 ? amountError : undefined}
                hint="Importe positivo con hasta 2 decimales"
              />

              <Button
                title={
                  referenceValidation?.valid
                    ? 'Referencia validada ✓ (volver a validar)'
                    : 'Validar referencia'
                }
                variant="secondary"
                disabled={Boolean(referenceError) || (amount.trim().length > 0 && Boolean(amountError))}
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

          {!biometricAvailable ? (
            <View style={styles.biometricNotice}>
              <Ionicons name="finger-print" size={20} color={colors.warning} />
              <View style={styles.biometricNoticeTexts}>
                <Text style={styles.biometricNoticeTitle}>Huella digital requerida para pagar</Text>
                <Text style={styles.biometricNoticeBody}>
                  Activa tu huella digital en la sección Perfil antes de autorizar pagos.
                </Text>
              </View>
            </View>
          ) : null}

          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}

          <Button
            title="Continuar y autorizar con huella"
            disabled={!canContinue}
            loading={payMutation.isPending}
            onPress={() => void handlePrepareConfirm()}
          />
        </Card>
      ) : null}

      <AppModal
        visible={confirmOpen}
        title="Autorización biométrica de pago"
        onRequestClose={() => setConfirmOpen(false)}
        actions={
          <>
            {biometricAvailable ? (
              <Button
                title="Autorizar pago con huella digital"
                loading={payMutation.isPending}
                onPress={() => void handleConfirmPayWithFingerprint()}
              />
            ) : (
              <Button
                title="Ir a Perfil para activar huella digital"
                variant="secondary"
                onPress={() => {
                  setConfirmOpen(false);
                  router.push('/(tabs)/profile');
                }}
              />
            )}
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

        <View style={styles.fingerprintPromptBox}>
          <Ionicons
            name="finger-print"
            size={28}
            color={biometricAvailable ? colors.primary : colors.warning}
          />
          <Text style={styles.fingerprintPromptText}>
            {biometricAvailable
              ? 'Por seguridad, este pago solo puede autorizarse escaneando tu huella digital registrada en este dispositivo móvil.'
              : 'Aún no tienes una huella digital activa en este dispositivo. Enrólala en Perfil para poder autorizar pagos.'}
          </Text>
        </View>

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
  title: { ...typography.title, color: colors.text },
  webRestrictionCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  webBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webRestrictionTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  webRestrictionBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  webActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.subheading, color: colors.textMuted, fontWeight: '700' },
  tabTextActive: { color: colors.textOnPrimary },
  card: { gap: spacing.md },
  productList: { gap: spacing.xs },
  productRow: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  productSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  sectionTitle: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  label: { ...typography.caption, color: colors.text, fontWeight: '600' },
  accountChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
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
  biometricNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  biometricNoticeTexts: { flex: 1, gap: 2 },
  biometricNoticeTitle: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  biometricNoticeBody: { ...typography.caption, color: colors.text },
  summaryBox: {
    backgroundColor: colors.surfaceMuted,
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
  summaryService: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  summaryProduct: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
  summaryAmount: { ...typography.subheading, color: colors.primary, fontWeight: '800' },
  fingerprintPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fingerprintPromptText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  error: { ...typography.caption, color: colors.danger },
});
