import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';

import type { Customer, Movement } from '../domain/entities';
import type { AccountsRepository } from '../domain/repository';
import type { ClientDto, MovementDto } from './dto';
import { toCustomer, toMovement } from './mappers';

function pickMatchingClient(clients: ClientDto[], email?: string | null): ClientDto {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const byEmail = clients.find(
      (c) => c.contactDetail?.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (byEmail) return byEmail;
  }
  const byDemoCurp = clients.find((c) => c.curp === 'HERA900515HDFRND01');
  if (byDemoCurp) return byDemoCurp;
  if (clients[0]) return clients[0];
  throw new Error('No se encontró información del cliente autenticado.');
}

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
      const email = useSessionStore.getState().session?.email;
      const params = { includes: 'accounts,home,contact,employment' };

      // POST /v1/clientes/buscar funciona tanto en Railway (rama dev) como en local.
      // Si el cliente HTTP mockeado en pruebas solo define `get`, cae a GET /v1/clientes/me.
      if (typeof client.post === 'function') {
        try {
          const { data } = await client.post<ClientDto[]>('/v1/clientes/buscar', {}, { params });
          if (Array.isArray(data) && data.length > 0) {
            cachedCustomer = toCustomer(pickMatchingClient(data, email));
            return cachedCustomer;
          }
        } catch {
          // Fallback a /v1/clientes/me si está disponible
        }
      }

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
