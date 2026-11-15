import { useQuery } from '@tanstack/react-query';

import { historyRepository } from '../data/historyRepository';
import type { PaymentHistoryFilters } from '../domain/entities';

export const historyKeys = {
  all: ['payment-history'] as const,
  list: (filters: PaymentHistoryFilters) => ['payment-history', 'list', filters] as const,
  detail: (idOrUpc: string) => ['payment-history', 'detail', idOrUpc] as const,
};

export function usePaymentHistory(filters: PaymentHistoryFilters) {
  return useQuery({
    queryKey: historyKeys.list(filters),
    queryFn: () => historyRepository.getHistory(filters),
  });
}

export function usePaymentHistoryDetail(idOrUpc: string) {
  return useQuery({
    queryKey: historyKeys.detail(idOrUpc),
    queryFn: () => historyRepository.getHistoryDetail(idOrUpc),
    enabled: Boolean(idOrUpc && idOrUpc.trim().length > 0),
  });
}

