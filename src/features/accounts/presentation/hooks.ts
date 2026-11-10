import { useQuery } from '@tanstack/react-query';

import { accountsRepository } from '../data/accountsRepository';
import { getMyAccounts, getRecentMovements, totalBalance } from '../domain/repository';

export const accountKeys = {
  customer: ['customer'] as const,
  movements: (accountNumber: string) => ['movements', accountNumber] as const,
  recent: (accountNumber: string) => ['movements', accountNumber, 'recent'] as const,
};

export function useCustomer() {
  return useQuery({
    queryKey: accountKeys.customer,
    queryFn: () => accountsRepository.getCurrentCustomer(),
  });
}

export function useAccounts() {
  const query = useCustomer();
  const accounts = query.data ? [...query.data.accounts] : [];
  return { ...query, accounts, total: totalBalance(accounts) };
}

export function useMovements(accountNumber: string | undefined) {
  return useQuery({
    queryKey: accountKeys.movements(accountNumber ?? ''),
    queryFn: () => accountsRepository.getMovements(accountNumber ?? ''),
    enabled: !!accountNumber,
  });
}

export function useRecentMovements(accountNumber: string | undefined, limit = 5) {
  return useQuery({
    queryKey: accountKeys.recent(accountNumber ?? ''),
    queryFn: () => getRecentMovements(accountsRepository, accountNumber ?? '', limit),
    enabled: !!accountNumber,
  });
}

export { getMyAccounts };
