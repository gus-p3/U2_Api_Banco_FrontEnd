import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { accountKeys } from '@/features/accounts/presentation/hooks';
import { reauthenticateWithFingerprint } from '@/features/auth/presentation/authActions';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';

import { paymentsRepository } from '../data/paymentsRepository';
import type { PaymentInput, PaymentReceipt } from '../domain/entities';
import { payProduct } from '../domain/usecases';

export const paymentKeys = { products: ['payment-products'] as const };

export const isPaymentsSupported = (): boolean => Platform.OS !== 'web';

export function useProducts() {
  return useQuery({
    queryKey: paymentKeys.products,
    queryFn: () => paymentsRepository.getProducts(),
    staleTime: 10 * 60 * 1000, // el catálogo se cachea también en Redis en el servidor
  });
}

export function usePay() {
  const queryClient = useQueryClient();
  return useMutation<PaymentReceipt, Error, PaymentInput>({
    mutationFn: (input) =>
      payProduct(
        {
          repo: paymentsRepository,
          getAuthMethod: () => useSessionStore.getState().session?.authMethod,
          reauthenticateWithFingerprint,
          isSupportedPlatform: isPaymentsSupported,
        },
        input,
      ),
    retry: false, // un pago nunca se reintenta automáticamente
    onSuccess: async (_receipt, input) => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      await queryClient.invalidateQueries({ queryKey: accountKeys.movements(input.accountNumber) });
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
