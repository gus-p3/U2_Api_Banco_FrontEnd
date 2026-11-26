import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { accountKeys } from '@/features/accounts/presentation/hooks';
import { confirmPaymentWithFingerprint } from '@/features/auth/presentation/authActions';

import { paymentsRepository } from '../data/paymentsRepository';
import type {
  PaymentInput,
  PaymentReceipt,
  Product,
  ReferenceValidationInput,
  ReferenceValidationResult,
} from '../domain/entities';
import { payProduct } from '../domain/usecases';

export const paymentKeys = { products: ['payment-products'] as const };

/** Los pagos funcionan en móvil (huella local) y en Web (autorización remota con huella en Android). */
export const isPaymentsSupported = (): boolean => true;

/** En Web el pago se solicita y espera confirmación biométrica con huella en el celular Android. */
export const isWebRemoteAuthMode = (): boolean => Platform.OS === 'web';

export function useProducts(enabled = true) {
  return useQuery({
    queryKey: paymentKeys.products,
    queryFn: () => paymentsRepository.getProducts(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useValidateReference() {
  return useMutation<ReferenceValidationResult, Error, ReferenceValidationInput>({
    mutationFn: (input) => paymentsRepository.validateReference(input),
    retry: false,
  });
}

export function useRefreshReceipt() {
  const queryClient = useQueryClient();
  return useMutation<PaymentReceipt, Error, { idOrUpc: string; current?: PaymentReceipt }>({
    mutationFn: ({ idOrUpc, current }) => paymentsRepository.getPaymentStatus(idOrUpc, current),
    retry: false,
    onSuccess: async (updated) => {
      receiptStore.set(updated);
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      if (updated.accountNumber) {
        await queryClient.invalidateQueries({
          queryKey: accountKeys.movements(updated.accountNumber),
        });
      }
    },
  });
}

export function usePay() {
  const queryClient = useQueryClient();
  return useMutation<PaymentReceipt, Error, PaymentInput>({
    mutationFn: (input) =>
      payProduct(
        {
          repo: paymentsRepository,
          confirmWithFingerprint: confirmPaymentWithFingerprint,
        },
        input,
      ),
    retry: false,
    onSuccess: async (_receipt, input) => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      await queryClient.invalidateQueries({ queryKey: accountKeys.movements(input.accountNumber) });
      await queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
  });
}

/** Último comprobante, compartido entre la pantalla de pago y la de comprobante. */
let lastReceipt: PaymentReceipt | null = null;
export const receiptStore = {
  set: (r: PaymentReceipt) => {
    lastReceipt = r;
  },
  get: () => lastReceipt,
  clear: () => {
    lastReceipt = null;
  },
};

/** Producto seleccionado para llenar el formulario en la pantalla dedicada de checkout. */
let selectedProductCache: Product | null = null;
export const selectedProductStore = {
  set: (p: Product) => {
    selectedProductCache = p;
  },
  get: () => selectedProductCache,
  clear: () => {
    selectedProductCache = null;
  },
};
