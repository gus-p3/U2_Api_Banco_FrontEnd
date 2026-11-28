import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, maskAccount } from '@/core/utils/format';
import {
  sanitizeDecimalAmount,
  validatePaymentAmount,
  validatePhone10,
  validateServiceReference,
} from '@/core/validation/validators';
import { accountKeys, useAccounts, useCustomer } from '@/features/accounts/presentation/hooks';
import { isBiometricConfirmationAvailable } from '@/features/auth/presentation/authActions';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { AppModal, Button, Card, EmptyState, Input, Loader, ProviderLogo, Screen } from '@/shared/ui';

import {
  cancelRemoteAuthorization,
  getRemoteAuthorizationStatus,
  type PagoAutorizacionDto,
  remoteAuthToReceipt,
  requestRemotePaymentAuth,
} from '../data/authorizationRepository';
import type { PaymentInput, PaymentKind, Product, ReferenceValidationResult } from '../domain/entities';
import {
  isWebRemoteAuthMode,
  receiptStore,
  selectedProductStore,
  usePay,
  useProducts,
  useValidateReference,
} from './hooks';

export function PaymentCheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string; productId?: string; serviceId?: string }>();
  const isWebRemote = isWebRemoteAuthMode();

  const cachedProduct = selectedProductStore.get();
  const needsCatalogLookup = !cachedProduct && Boolean(params.productId);
  const productsQuery = useProducts(needsCatalogLookup);

  const selectedProduct: Product | null = useMemo(() => {
    if (
      cachedProduct &&
      (!params.productId || String(cachedProduct.idProducto) === String(params.productId))
    ) {
      return cachedProduct;
    }
    if (params.productId && productsQuery.data) {
      return (
        productsQuery.data.find(
          (p) =>
            String(p.idProducto) === String(params.productId) &&
            (!params.serviceId || String(p.idServicio) === String(params.serviceId)),
        ) ?? null
      );
    }
    return cachedProduct;
  }, [cachedProduct, params.productId, params.serviceId, productsQuery.data]);

  const kind: PaymentKind =
    selectedProduct?.kind === 'RECARGA' || selectedProduct?.kind === 'SERVICIO'
      ? selectedProduct.kind
      : params.tab === 'SERVICIO'
        ? 'SERVICIO'
        : 'RECARGA';

  const { accounts } = useAccounts();
  const { data: customer } = useCustomer();
  const operationLimit = customer?.operationAmountMax;
  const validateRefMutation = useValidateReference();
  const payMutation = usePay();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [reference, setReference] = useState('');
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [amount, setAmount] = useState(
    selectedProduct?.kind === 'SERVICIO' && selectedProduct.price && selectedProduct.price > 0
      ? String(selectedProduct.price)
      : '',
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [referenceValidation, setReferenceValidation] = useState<ReferenceValidationResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [remoteAuth, setRemoteAuth] = useState<PagoAutorizacionDto | null>(null);
  const [remoteInput, setRemoteInput] = useState<PaymentInput | null>(null);
  const [remoteRequesting, setRemoteRequesting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWebRemote) {
      void isBiometricConfirmationAvailable().then(setBiometricAvailable);
    }
  }, [isWebRemote]);

  useEffect(() => {
    if (!selectedAccount && accounts[0]) {
      const firstActive = accounts.find((a) => a.status === 'ACTIVA') ?? accounts[0];
      setSelectedAccount(firstActive.number);
    }
  }, [accounts, selectedAccount]);

  useEffect(() => {
    if (
      selectedProduct?.kind === 'SERVICIO' &&
      selectedProduct.price &&
      selectedProduct.price > 0 &&
      !amount
    ) {
      setAmount(String(selectedProduct.price));
    }
  }, [selectedProduct, amount]);

  useEffect(() => {
    if (!remoteAuth || remoteAuth.estado !== 'PENDIENTE' || !remoteInput) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const updated = await getRemoteAuthorizationStatus(remoteAuth.idAutorizacion);
        if (!active) return;
        setRemoteAuth(updated);
        if (updated.estado === 'APROBADO') {
          clearInterval(timer);
          await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
          await queryClient.invalidateQueries({
            queryKey: accountKeys.movements(remoteInput.accountNumber),
          });
          await queryClient.invalidateQueries({ queryKey: ['payment-history'] });
          const receipt = remoteAuthToReceipt(updated, remoteInput);
          setRemoteAuth(null);
          setRemoteInput(null);
          if (receipt) {
            receiptStore.set(receipt);
            router.replace('/payment/receipt');
          }
        } else if (updated.estado === 'RECHAZADO') {
          clearInterval(timer);
          setRemoteError('El pago fue rechazado desde tu dispositivo móvil.');
        } else if (updated.estado === 'EXPIRADO') {
          clearInterval(timer);
          setRemoteError('La solicitud expiró sin autorización en tu celular. Intenta de nuevo.');
        } else if (updated.estado === 'CANCELADO') {
          clearInterval(timer);
          setRemoteAuth(null);
          setRemoteInput(null);
        }
      } catch {
        // Reintenta en el siguiente intervalo
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [remoteAuth, remoteInput, queryClient, router]);

  const selectedAccountObj = useMemo(
    () => accounts.find((a) => a.number === selectedAccount),
    [accounts, selectedAccount],
  );

  const effectiveAmount = kind === 'RECARGA' ? (selectedProduct?.price ?? 0) : Number(amount) || 0;

  const accountError = useMemo(() => {
    if (!selectedAccount) return 'Selecciona una cuenta de cargo.';
    if (!/^[0-9]{10}$/.test(selectedAccount)) return 'El número de cuenta no es válido.';
    if (selectedAccountObj && selectedAccountObj.status !== 'ACTIVA') {
      return 'La cuenta seleccionada se encuentra inactiva para realizar pagos.';
    }
    if (selectedAccountObj && effectiveAmount > 0 && selectedAccountObj.balance < effectiveAmount) {
      return `Saldo insuficiente en la cuenta (${formatCurrency(selectedAccountObj.balance)} disponible).`;
    }
    if (operationLimit && effectiveAmount > operationLimit) {
      return `El importe supera tu monto de operación configurado (${customer?.operationAmountLabel ?? formatCurrency(operationLimit)}). Puedes ajustarlo en Perfil.`;
    }
    return undefined;
  }, [
    selectedAccount,
    selectedAccountObj,
    effectiveAmount,
    operationLimit,
    customer?.operationAmountLabel,
  ]);

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
      maxLimit: operationLimit,
    });
  }, [kind, amount, selectedAccountObj?.balance, selectedProduct?.price, operationLimit]);

  if (needsCatalogLookup && productsQuery.isLoading) {
    return (
      <Screen>
        <Loader message="Cargando detalles del servicio..." />
      </Screen>
    );
  }

  if (!selectedProduct) {
    return (
      <Screen>
        <EmptyState
          title="No hay un servicio seleccionado"
          description="Elige una recarga o servicio del listado para continuar con tu pago."
          actionLabel="Volver a Pagos"
          onAction={() => router.replace('/(tabs)/payments')}
        />
      </Screen>
    );
  }

  const handleValidateReference = async () => {
    setFormError(null);
    setReferenceValidation(null);
    setReferenceTouched(true);
    if (amount.trim()) setAmountTouched(true);

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
    !accountError &&
    (kind === 'RECARGA'
      ? !phoneError
      : !referenceError && !amountError && Boolean(referenceValidation?.valid));

  const handlePrepareConfirm = async () => {
    setFormError(null);
    setPhoneTouched(true);
    setReferenceTouched(true);
    setAmountTouched(true);

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

    if (isWebRemote) {
      setConfirmError(null);
      setConfirmOpen(true);
      return;
    }

    const bioReady = await isBiometricConfirmationAvailable();
    setBiometricAvailable(bioReady);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const handleConfirmPay = async () => {
    setConfirmError(null);
    setFormError(null);
    const input: PaymentInput = {
      accountNumber: selectedAccount,
      product: selectedProduct,
      kind,
      phone: kind === 'RECARGA' ? phone.trim() : undefined,
      reference: kind === 'SERVICIO' ? reference.trim() : undefined,
      amount: kind === 'SERVICIO' ? Number(amount) : undefined,
      referenceValidated: kind === 'SERVICIO' ? Boolean(referenceValidation?.valid) : true,
      useBiometricConfirmation: true,
    };

    if (isWebRemote) {
      setRemoteRequesting(true);
      setRemoteError(null);
      try {
        const auth = await requestRemotePaymentAuth(input);
        setConfirmOpen(false);
        setRemoteInput(input);
        setRemoteAuth(auth);
      } catch (e) {
        setConfirmError(toAppError(e).message);
      } finally {
        setRemoteRequesting(false);
      }
      return;
    }

    try {
      const receipt = await payMutation.mutateAsync(input);
      setConfirmOpen(false);
      receiptStore.set(receipt);
      router.replace('/payment/receipt');
    } catch (e) {
      setConfirmError(toAppError(e).message);
    }
  };

  const handleCancelRemoteAuth = async () => {
    if (!remoteAuth) return;
    if (remoteAuth.estado === 'PENDIENTE') {
      await cancelRemoteAuthorization(remoteAuth.idAutorizacion).catch(() => undefined);
    }
    setRemoteAuth(null);
    setRemoteInput(null);
    setRemoteError(null);
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Cambiar servicio o producto</Text>
      </Pressable>

      <Text style={styles.title}>{kind === 'RECARGA' ? 'Completar recarga' : 'Pagar servicio'}</Text>

      <Card style={styles.productBanner}>
        <View style={styles.summaryHeader}>
          <ProviderLogo name={selectedProduct.serviceName} logoUrl={selectedProduct.logoUrl} size={48} />
          <View style={styles.summaryHeaderTexts}>
            <Text style={styles.summaryService}>{selectedProduct.serviceName}</Text>
            <Text style={styles.summaryProduct}>{selectedProduct.name}</Text>
            {selectedProduct.price ? (
              <Text style={styles.pricePill}>{formatCurrency(selectedProduct.price)}</Text>
            ) : null}
          </View>
        </View>
        {selectedProduct.description ? (
          <Text style={styles.productLegend}>{selectedProduct.description}</Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.fieldLabel}>Cuenta de cargo</Text>
        <View style={styles.accountsRow}>
          {accounts.map((acc) => {
            const active = selectedAccount === acc.number;
            return (
              <Pressable
                key={acc.id}
                style={[styles.accChip, active && styles.accChipActive]}
                onPress={() => setSelectedAccount(acc.number)}
              >
                <Text style={[styles.accChipText, active && styles.accChipTextActive]}>
                  {maskAccount(acc.number)} ({formatCurrency(acc.balance)})
                </Text>
              </Pressable>
            );
          })}
        </View>
        {accountError ? (
          <Text accessibilityRole="alert" style={styles.fieldError}>
            {accountError}
          </Text>
        ) : null}

        {kind === 'RECARGA' ? (
          <Input
            label="Número de teléfono (10 dígitos)"
            keyboardType="number-pad"
            maxLength={10}
            placeholder="5512345678"
            value={phone}
            onChangeText={(val) => {
              setPhone(val.replace(/[^0-9]/g, ''));
              setPhoneTouched(true);
            }}
            onBlur={() => setPhoneTouched(true)}
            error={phoneTouched ? phoneError : undefined}
            hint={
              selectedProduct.price
                ? `Monto fijo de la recarga: ${formatCurrency(selectedProduct.price)} (sin comisión para ti)`
                : undefined
            }
          />
        ) : (
          <>
            <Input
              label="Referencia del servicio"
              placeholder="Ej. 40425475190118187271"
              maxLength={100}
              value={reference}
              onChangeText={(val) => {
                setReference(val);
                setReferenceTouched(true);
                setReferenceValidation(null);
              }}
              onBlur={() => setReferenceTouched(true)}
              error={referenceTouched ? referenceError : undefined}
              hint={
                selectedProduct.referenceType
                  ? `Formato esperado: ${selectedProduct.referenceType}${
                      selectedProduct.hasCheckDigit ? ' (con dígito verificador)' : ''
                    }`
                  : 'Ingresa la referencia tal como aparece en tu recibo.'
              }
            />

            <Input
              label="Monto a pagar (MXN)"
              keyboardType="decimal-pad"
              placeholder="150.00"
              value={amount}
              onChangeText={(val) => {
                setAmount(sanitizeDecimalAmount(val));
                setAmountTouched(true);
                setReferenceValidation(null);
              }}
              onBlur={() => setAmountTouched(true)}
              error={amountTouched ? amountError : undefined}
              hint={
                selectedProduct.price
                  ? `Este servicio tiene monto fijo: ${formatCurrency(selectedProduct.price)}`
                  : customer?.operationAmountLabel
                    ? `Hasta 2 decimales. Tu límite de operación: ${customer.operationAmountLabel}.`
                    : 'Hasta 2 decimales. Sin comisión para el cliente.'
              }
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
                  referenceValidation.valid ? styles.validationBoxSuccess : styles.validationBoxError,
                ]}
                accessibilityRole="summary"
              >
                <Text style={styles.validationTitle}>
                  {referenceValidation.valid ? 'Referencia válida en GestoPago' : 'Referencia inválida'}
                </Text>
                <Text style={styles.validationText}>{referenceValidation.message}</Text>
                {referenceValidation.valid ? (
                  <>
                    <Text style={styles.validationMeta}>
                      Servicio: {referenceValidation.serviceName ?? selectedProduct.serviceName} ·{' '}
                      {referenceValidation.productName ?? selectedProduct.name}
                    </Text>
                    {referenceValidation.holderName ? (
                      <Text style={styles.validationMeta}>
                        Titular: {referenceValidation.holderName}
                      </Text>
                    ) : null}
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

        {isWebRemote ? (
          <View style={styles.biometricNotice}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
            <View style={styles.biometricNoticeTexts}>
              <Text style={styles.biometricNoticeTitle}>
                Autorización en 2 pasos con tu celular Android
              </Text>
              <Text style={styles.biometricNoticeBody}>
                Al continuar enviaremos una notificación a tu teléfono para que apruebes el pago con tu
                huella digital.
              </Text>
            </View>
          </View>
        ) : !biometricAvailable ? (
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
          title={isWebRemote ? 'Enviar autorización a mi celular' : 'Continuar y autorizar con huella'}
          disabled={!canContinue}
          loading={payMutation.isPending || remoteRequesting}
          onPress={() => void handlePrepareConfirm()}
        />
      </Card>

      <AppModal
        visible={confirmOpen}
        title={isWebRemote ? 'Enviar autorización al celular' : 'Autorización biométrica de pago'}
        onRequestClose={() => setConfirmOpen(false)}
        actions={
          <>
            {isWebRemote ? (
              <Button
                title="Enviar notificación a mi Android"
                loading={remoteRequesting}
                onPress={() => void handleConfirmPay()}
              />
            ) : biometricAvailable ? (
              <Button
                title="Autorizar pago con huella digital"
                loading={payMutation.isPending}
                onPress={() => void handleConfirmPay()}
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

        <View style={styles.fingerprintPromptBox}>
          <Ionicons
            name={isWebRemote ? 'phone-portrait-outline' : 'finger-print'}
            size={28}
            color={isWebRemote || biometricAvailable ? colors.primary : colors.warning}
          />
          <Text style={styles.fingerprintPromptText}>
            {isWebRemote
              ? 'Enviaremos una notificación a tu app Android. Abre el aviso en tu celular y coloca tu huella digital para completar el pago.'
              : biometricAvailable
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

      <AppModal
        visible={Boolean(remoteAuth)}
        title="Esperando autorización en tu celular"
        onRequestClose={() => void handleCancelRemoteAuth()}
        actions={
          <Button
            title={remoteAuth?.estado === 'PENDIENTE' ? 'Cancelar solicitud' : 'Cerrar'}
            variant={remoteAuth?.estado === 'PENDIENTE' ? 'danger' : 'secondary'}
            onPress={() => void handleCancelRemoteAuth()}
          />
        }
      >
        <View style={styles.fingerprintPromptBox}>
          <Ionicons name="finger-print" size={32} color={colors.primary} />
          <Text style={styles.fingerprintPromptText}>
            {remoteAuth?.estado === 'PENDIENTE'
              ? 'Revisa la notificación en tu teléfono Android, ábrela y coloca tu huella digital para autorizar este pago.'
              : (remoteError ?? 'Solicitud finalizada.')}
          </Text>
        </View>
        {remoteAuth?.estado === 'PENDIENTE' ? (
          <Loader message="Esperando confirmación biométrica desde tu móvil..." />
        ) : null}
        {remoteError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {remoteError}
          </Text>
        ) : null}
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  productBanner: { marginBottom: spacing.md, gap: spacing.sm },
  productLegend: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  pricePill: {
    ...typography.subheading,
    color: colors.primary,
    marginTop: 2,
  },
  card: { gap: spacing.md, marginBottom: spacing.lg },
  fieldLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  accChip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  accChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  accChipText: { ...typography.caption, color: colors.text },
  accChipTextActive: { color: colors.primary, fontWeight: '700' },
  fieldError: { ...typography.caption, color: colors.danger },
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
  validationTitle: { ...typography.caption, fontWeight: '700', color: colors.text },
  validationText: { ...typography.caption, color: colors.text },
  validationMeta: { ...typography.caption, color: colors.textMuted },
  biometricNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  biometricNoticeTexts: { flex: 1, gap: 2 },
  biometricNoticeTitle: { ...typography.caption, fontWeight: '700', color: colors.text },
  biometricNoticeBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  summaryBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryHeaderTexts: { flex: 1 },
  summaryService: { ...typography.subheading, color: colors.text },
  summaryProduct: { ...typography.caption, color: colors.textMuted },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryValue: { ...typography.caption, color: colors.text, fontWeight: '600', flexShrink: 1 },
  summaryAmount: { ...typography.subheading, color: colors.primary },
  fingerprintPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fingerprintPromptText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
