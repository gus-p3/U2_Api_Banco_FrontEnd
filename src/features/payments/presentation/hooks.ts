import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { accountKeys } from '@/features/accounts/presentation/hooks';
import { confirmPaymentWithFingerprint } from '@/features/auth/presentation/authActions';

import { paymentsRepository } from '../data/paymentsRepository';
import type {
  PaymentInput,
  PaymentReceipt,
  ReferenceValidationInput,
  ReferenceValidationResult,
} from '../domain/entities';
import { payProduct } from '../domain/usecases';

export const paymentKeys = { products: ['payment-products'] as const };

/** Los pagos están permitidos exclusivamente en la app móvil con huella digital (nunca en Web). */
export const isPaymentsSupported = (): boolean => Platform.OS !== 'web';

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
