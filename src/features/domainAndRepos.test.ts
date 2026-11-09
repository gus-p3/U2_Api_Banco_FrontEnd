import type { AxiosInstance } from 'axios';

import { createHttpClient } from '@/core/http/client';
import { toAppError } from '@/core/errors/toAppError';
import { createAuthRepository } from '@/features/auth/data/authRepository';
import { loginWithBiometrics, loginWithPassword } from '@/features/auth/domain/usecases';
import { createAccountsRepository } from '@/features/accounts/data/accountsRepository';
import { getRecentMovements, totalBalance } from '@/features/accounts/domain/repository';
import { createPaymentsRepository } from '@/features/payments/data/paymentsRepository';
import { payProduct } from '@/features/payments/domain/usecases';

function toBase64Url(json: string): string {
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(claims: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.sig`;
}

describe('Errores y cliente HTTP (refresh en 401)', () => {
  it('mapea ErrorResponse del backend y el 401 de inactividad a mensajes en español', () => {
    const axiosErr = {
      isAxiosError: true,
      response: {
        status: 422,
        data: { error: { code: 'INSUFFICIENT_FUNDS', message: 'raw' } },
      },
    };
    expect(toAppError(axiosErr).message).toBe('Saldo insuficiente para realizar el pago.');

    const inactivityErr = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { status: 401, inactivityLimitSeconds: 300, message: 'Expiró' },
      },
    };
    const mapped = toAppError(inactivityErr);
    expect(mapped.code).toBe('SESSION_INACTIVE');
  });

  it('renueva el access token ante 401 TOKEN_EXPIRED_OR_INVALID y reintenta una sola vez', async () => {
    let calls = 0;
    let currentToken = 'expired-token';
    const ended: string[] = [];

    const client = createHttpClient(
      {
        adapter: async (config) => {
          calls += 1;
          const auth = config.headers?.get('Authorization');
          if (calls === 1) {
            expect(auth).toBe('Bearer expired-token');
            return Promise.reject({
              isAxiosError: true,
              config,
              response: {
                status: 401,
                data: { error: { code: 'TOKEN_EXPIRED_OR_INVALID', message: 'expirado' } },
              },
            });
          }
          expect(auth).toBe('Bearer fresh-token');
          return {
            data: { ok: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        },
      },
      () => ({
        getAccessToken: () => currentToken,
        refreshTokens: async () => {
          currentToken = 'fresh-token';
          return currentToken;
        },
        onSessionEnded: (r) => ended.push(r),
      }),
    );

    const res = await client.get<{ ok: boolean }>('/v1/clientes/me');
    expect(res.data.ok).toBe(true);
    expect(calls).toBe(2);
    expect(ended).toHaveLength(0);
  });
});

describe('Casos de uso y repositorios (Auth, Cuentas y Pagos)', () => {
  it('loginWithPassword y createAuthRepository extraen idClient del JWT y guardan email', async () => {
    const token = makeJwt({
      sub: 'alejandro.hernandez@banco-demo.com',
      idClient: 7,
      authMethod: 'PASSWORD',
    });
    const post = jest.fn().mockResolvedValue({
      data: {
        token,
        refreshToken: 'rt-1',
        email: 'alejandro.hernandez@banco-demo.com',
        hasBiometricRegistered: true,
      },
    });
    const repo = createAuthRepository({ post, get: jest.fn() } as unknown as AxiosInstance);
    const savedEmails: string[] = [];
    const store = {
      getBiometricSecret: async () => 'bio-secret',
      saveBiometricSecret: async () => undefined,
      removeBiometricSecret: async () => undefined,
      getRefreshToken: async () => null,
      saveRefreshToken: async () => undefined,
      clearRefreshToken: async () => undefined,
      getLastEmail: async () => null,
      saveLastEmail: async (e: string) => {
        savedEmails.push(e);
      },
    };

    const result = await loginWithPassword(
      { repo, store },
      'alejandro.hernandez@banco-demo.com',
      'PasswordSegura#2026',
    );
    expect(result.session.idClient).toBe(7);
    expect(savedEmails).toEqual(['alejandro.hernandez@banco-demo.com']);

    const bioResult = await loginWithBiometrics(
      {
        repo: {
          ...repo,
          loginBiometric: jest.fn().mockResolvedValue(result),
        },
        store,
        biometrics: {
          isAvailable: async () => true,
          authenticate: async () => true,
          generateSecret: async () => 'sec',
        },
      },
      'alejandro.hernandez@banco-demo.com',
    );
    expect(bioResult.session.idClient).toBe(7);
  });

  it('calcula saldo total de cuentas activas y mapea movimientos con signo', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [
        {
          idBalance: 1,
          idAccount: 10,
          accountNumber: '9876543210',
          previousBalance: 25000,
          amount: 100,
          currentBalance: 24900,
          movementType: 'PAGO_SERVICIO',
          description: 'Recarga Telcel',
          createdAt: '2026-11-08T10:00:00Z',
        },
      ],
    });
    const repo = createAccountsRepository({ get } as unknown as AxiosInstance);
    const movs = await getRecentMovements(repo, '9876543210', 5);
    expect(movs[0]?.signedAmount).toBe(-100);
    expect(
      totalBalance([
        { id: 1, number: '1', balance: 1500, status: 'ACTIVA' },
        { id: 2, number: '2', balance: 900, status: 'INACTIVA' },
      ]),
    ).toBe(1500);
  });

  it('soporta backend cloud Railway: busca cliente por /v1/clientes/buscar y genera movimiento de apertura si /movimientos da 404', async () => {
    const post = jest.fn().mockResolvedValue({
      data: [
        {
          name: 'Alejandro',
          lastName: 'Hernández',
          curp: 'HERA900515HDFRND01',
          contactDetail: { email: 'alejandro.hernandez@banco-demo.com' },
          primaryAccount: {
            idAccount: 1,
            accountNumber: '8336580575',
            balance: 25000,
            status: 'ACTIVA',
            openedAt: '2026-04-06T23:54:47Z',
          },
          accounts: [
            {
              idAccount: 1,
              accountNumber: '8336580575',
              balance: 25000,
              status: 'ACTIVA',
              openedAt: '2026-04-06T23:54:47Z',
            },
          ],
        },
      ],
    });
    const get = jest.fn().mockRejectedValue(new Error('404 Not Found'));
    const repo = createAccountsRepository({ post, get } as unknown as AxiosInstance);

    const customer = await repo.getCurrentCustomer();
    expect(customer.fullName).toBe('Alejandro Hernández');
    expect(customer.primaryAccount?.number).toBe('8336580575');

    const movs = await repo.getMovements('8336580575');
    expect(movs).toHaveLength(1);
    expect(movs[0]?.type).toBe('APERTURA');
    expect(movs[0]?.signedAmount).toBe(25000);
  });

  it('payProduct re-autentica con huella cuando el token no es BIOMETRIC_HUELLA y envía solo campos permitidos', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        codigo: 1,
        mensaje: 'Transacción aprobada',
        estado: 'APLICADO',
        numAutorizacion: 'AUTH123',
        idTx: 99,
      },
    });
    const repo = createPaymentsRepository({ post, get: jest.fn() } as unknown as AxiosInstance);
    let authMethod = 'PASSWORD';
    const reauth = jest.fn(async () => {
      authMethod = 'BIOMETRIC_HUELLA';
    });

    const receipt = await payProduct(
      {
        repo,
        getAuthMethod: () => authMethod,
        reauthenticateWithFingerprint: reauth,
        isSupportedPlatform: () => true,
      },
      {
        accountNumber: '9876543210',
        kind: 'RECARGA',
        phone: '5512345678',
        product: {
          id: 1,
          name: 'Telcel 100',
          serviceName: 'Telcel',
          idServicio: 133,
          idProducto: 582,
          kind: 'RECARGA',
          price: 100,
          hasCheckDigit: false,
          helpAvailable: false,
        },
      },
    );

    expect(reauth).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/v1/pagos', {
      numCuenta: '9876543210',
      idServicio: 133,
      idProducto: 582,
      tipoPago: 'RECARGA',
      telefono: '5512345678',
    });
    expect(receipt.applied).toBe(true);
    expect(receipt.authorization).toBe('AUTH123');
  });
});
