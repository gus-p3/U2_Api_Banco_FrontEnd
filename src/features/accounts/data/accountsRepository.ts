import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';

import type { Customer, Movement } from '../domain/entities';
import type { AccountsRepository } from '../domain/repository';
import type { ClientDto, MovementDto } from './dto';
import { toCustomer, toMovement } from './mappers';

function buildFallbackMovements(customer: Customer | null, accountNumber: string): Movement[] {
  const account = customer?.accounts.find((a) => a.number === accountNumber) ?? customer?.primaryAccount;
  if (!account) return [];
  return [
    {
      id: account.id,
      accountNumber: account.number,
      previousBalance: 0,
      signedAmount: account.balance,
      currentBalance: account.balance,
      type: 'APERTURA',
      description: 'Saldo disponible en cuenta',
      createdAt: account.openedAt ?? new Date().toISOString(),
    },
  ];
}

export function createAccountsRepository(client: AxiosInstance): AccountsRepository {
  let cachedCustomer: Customer | null = null;

  return {
    async getCurrentCustomer() {
      // Solo el cliente dueño del JWT: la consulta global (/buscar) es exclusiva del rol ADMIN.
      const params = { includes: 'accounts,home,contact,employment' };
      const { data } = await client.get<ClientDto>('/v1/clientes/me', { params });
      cachedCustomer = toCustomer(data);
      return cachedCustomer;
    },

    async getMovements(accountNumber) {
      try {
        const { data } = await client.get<MovementDto[]>(
          `/v1/cuentas/${encodeURIComponent(accountNumber)}/movimientos`,
        );
        return data.map(toMovement);
      } catch {
        // En el backend cloud (Railway rama dev) aún no está expuesto /v1/cuentas/{num}/movimientos.
        // Generamos el movimiento base de la cuenta para no romper la vista de Inicio ni Detalle.
        if (!cachedCustomer && typeof client.post === 'function') {
          try {
            await this.getCurrentCustomer();
          } catch {
            // Ignorar si falla la carga secundaria
          }
        }
        return buildFallbackMovements(cachedCustomer, accountNumber);
      }
    },
  };
}

export const accountsRepository = createAccountsRepository(http);
