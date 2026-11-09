import type { Account, Customer, Movement } from './entities';

export interface AccountsRepository {
  getCurrentCustomer(): Promise<Customer>;
  getMovements(accountNumber: string): Promise<Movement[]>;
}

/** Caso de uso: cuentas del cliente autenticado (activas primero). */
export async function getMyAccounts(repo: AccountsRepository): Promise<Account[]> {
  const customer = await repo.getCurrentCustomer();
  return [...customer.accounts].sort(
    (a, b) => Number(b.status === 'ACTIVA') - Number(a.status === 'ACTIVA'),
  );
}

/** Caso de uso: saldo total sumando solo cuentas activas. */
export function totalBalance(accounts: Account[]): number {
  return accounts
    .filter((a) => a.status === 'ACTIVA' || a.status === 'ACTIVE')
    .reduce((sum, a) => sum + a.balance, 0);
}

/** Caso de uso: últimos N movimientos de una cuenta. */
export async function getRecentMovements(
  repo: AccountsRepository,
  accountNumber: string,
  limit = 5,
): Promise<Movement[]> {
  const all = await repo.getMovements(accountNumber);
  return all.slice(0, limit);
}
