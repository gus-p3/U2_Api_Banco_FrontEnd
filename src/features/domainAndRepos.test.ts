import type { AxiosInstance } from 'axios';

import { createHttpClient } from '@/core/http/client';
import { toAppError } from '@/core/errors/toAppError';
import { createAuthRepository } from '@/features/auth/data/authRepository';
import { loginWithBiometrics, loginWithPassword } from '@/features/auth/domain/usecases';
import { createAccountsRepository } from '@/features/accounts/data/accountsRepository';
import { getRecentMovements, totalBalance } from '@/features/accounts/domain/repository';
import { createHistoryRepository } from '@/features/history/data/historyRepository';
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

  it('soporta backend cloud Railway: consulta al cliente por /v1/clientes/me y genera movimiento de apertura si /movimientos da 404', async () => {
    const clientDto = {
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
    };
    const get = jest.fn(async (url: string) => {
      if (url === '/v1/clientes/me') return { data: clientDto };
      throw new Error('404 Not Found');
    });
    const post = jest.fn();
    const repo = createAccountsRepository({ post, get } as unknown as AxiosInstance);

    const customer = await repo.getCurrentCustomer();
    expect(customer.fullName).toBe('Alejandro Hernández');
    expect(customer.primaryAccount?.number).toBe('8336580575');

    expect(post).not.toHaveBeenCalled(); // /buscar es solo ADMIN
    const movs = await repo.getMovements('8336580575');
    expect(movs).toHaveLength(1);
    expect(movs[0]?.type).toBe('APERTURA');
    expect(movs[0]?.signedAmount).toBe(25000);
  });

  it('payProduct solicita confirmación reciente (contraseña o huella) y envía X-Confirmation-Token en web y móvil', async () => {
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
    const confirmWithPassword = jest.fn(async (pwd: string) => `confirm-token-${pwd}`);
    const confirmWithFingerprint = jest.fn(async () => 'confirm-token-bio');

    const receipt = await payProduct(
      {
        repo,
        confirmWithPassword,
        confirmWithFingerprint,
      },
      {
        accountNumber: '9876543210',
        kind: 'RECARGA',
        phone: '5512345678',
        confirmationPassword: 'PasswordSegura#2026',
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

    expect(confirmWithPassword).toHaveBeenCalledWith('PasswordSegura#2026');
    expect(post).toHaveBeenCalledWith(
      '/v1/pagos',
      {
        numCuenta: '9876543210',
        idServicio: 133,
        idProducto: 582,
        tipoPago: 'RECARGA',
        telefono: '5512345678',
      },
      {
        headers: { 'X-Confirmation-Token': 'confirm-token-PasswordSegura#2026' },
      },
    );
    expect(receipt.applied).toBe(true);
    expect(receipt.authorization).toBe('AUTH123');

    // También soporta confirmación biométrica en móvil
    await payProduct(
      {
        repo,
        confirmWithPassword,
        confirmWithFingerprint,
      },
      {
        accountNumber: '9876543210',
        kind: 'RECARGA',
        phone: '5512345678',
        useBiometricConfirmation: true,
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
    expect(confirmWithFingerprint).toHaveBeenCalledTimes(1);

    // Rechaza con STRONG_AUTH_REQUIRED si no se proporciona confirmación
    await expect(
      payProduct(
        { repo, confirmWithPassword, confirmWithFingerprint },
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
      ),
    ).rejects.toMatchObject({ code: 'STRONG_AUTH_REQUIRED' });
  });

  it('getProducts devuelve vacío si el backend devuelve vacío (sin datos simulados) y mapea legend y categoría', async () => {
    const getEmpty = jest.fn().mockResolvedValue({ data: [] });
    const repoEmpty = createPaymentsRepository({
      post: jest.fn(),
      get: getEmpty,
    } as unknown as AxiosInstance);
    expect(await repoEmpty.getProducts()).toEqual([]);

    const getCatalog = jest.fn().mockResolvedValue({
      data: [
        {
          id: 10,
          producto: 'Recarga 50',
          servicio: 'Telcel',
          idServicio: 133,
          idProducto: 581,
          idCatTipoServicio: 1,
          tipoFront: 1,
          precio: '50.00',
          legend: 'Ingresa los 10 dígitos de tu línea Telcel',
          categoria: 'Recargas',
        },
      ],
    });
    const repoCatalog = createPaymentsRepository({
      post: jest.fn(),
      get: getCatalog,
    } as unknown as AxiosInstance);
    const items = await repoCatalog.getProducts();
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBe('Ingresa los 10 dígitos de tu línea Telcel');
    expect(items[0]?.category).toBe('Recargas');
  });

  it('Fase 4: validateReference distingue referencia válida, inválida y bloquea pago de servicio sin validar', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          valida: true,
          estadoValidacion: 'VALIDA',
          validationId: 'val-123',
          idServicio: 79,
          idProducto: 209,
          referencia: '998877665544',
          nombreServicio: 'CFE',
          nombreProducto: 'Luz CFE',
          categoria: 'Servicios',
          descripcion: 'Pago de recibo CFE',
          mensaje: 'Referencia verificada correctamente',
        },
      })
      .mockResolvedValueOnce({
        data: {
          valida: false,
          estadoValidacion: 'INVALIDA',
          idServicio: 79,
          idProducto: 209,
          referencia: '0000000000',
          nombreServicio: 'CFE',
          nombreProducto: 'Luz CFE',
          mensaje: 'Referencia rechazada por el proveedor',
        },
      });

    const repo = createPaymentsRepository({ post, get: jest.fn() } as unknown as AxiosInstance);

    const validRes = await repo.validateReference({
      idServicio: 79,
      idProducto: 209,
      reference: '998877665544',
      amount: 150,
    });
    expect(validRes.valid).toBe(true);
    expect(validRes.validationId).toBe('val-123');
    expect(validRes.serviceName).toBe('CFE');

    const invalidRes = await repo.validateReference({
      idServicio: 79,
      idProducto: 209,
      reference: '0000000000',
      amount: 150,
    });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.message).toContain('rechazada');

    // Intento de pago de SERVICIO sin haber validado la referencia falla con REFERENCE_NOT_VALIDATED
    await expect(
      payProduct(
        {
          repo,
          confirmWithPassword: async () => 'confirm-tok',
        },
        {
          accountNumber: '9876543210',
          kind: 'SERVICIO',
          reference: '998877665544',
          amount: 150,
          referenceValidated: false,
          confirmationPassword: 'PasswordSegura#2026',
          product: {
            id: 2,
            name: 'Luz CFE',
            serviceName: 'CFE',
            idServicio: 79,
            idProducto: 209,
            kind: 'SERVICIO',
            hasCheckDigit: true,
            helpAvailable: true,
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'REFERENCE_NOT_VALIDATED' });
  });

  it('Fase 5: applied solo es true con estado === APLICADO y getPaymentStatus refresca un recibo POR_CONFIRMAR', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          codigo: 1, // incluso si codigo viniera en 1 por error, estado POR_CONFIRMAR nunca es applied=true
          mensaje: 'Pago en proceso de confirmación',
          estado: 'POR_CONFIRMAR',
          upc: 'UPC123456',
        },
      })
      .mockResolvedValueOnce({
        data: {
          codigo: 0,
          mensaje: 'Saldo insuficiente del distribuidor',
          estado: 'RECHAZADO',
          upc: 'UPC123457',
        },
      });

    const get = jest.fn().mockResolvedValueOnce({
      data: {
        id: 45,
        codigo: 1,
        mensaje: 'Transacción confirmada',
        estado: 'APLICADO',
        tipoPago: 'RECARGA',
        numCuenta: '9876543210',
        idServicio: 133,
        idProducto: 582,
        nombreServicio: 'Telcel',
        nombreProducto: 'Telcel 100',
        telefono: '5512345678',
        monto: 100,
        numAutorizacion: 'AUTH-OK-99',
        idTx: 777111,
        upc: 'UPC123456',
      },
    });

    const repo = createPaymentsRepository({ post, get } as unknown as AxiosInstance);
    const product = {
      id: 1,
      name: 'Telcel 100',
      serviceName: 'Telcel',
      idServicio: 133,
      idProducto: 582,
      kind: 'RECARGA' as const,
      price: 100,
      hasCheckDigit: false,
      helpAvailable: false,
    };

    const pendingReceipt = await repo.pay(
      { accountNumber: '9876543210', kind: 'RECARGA', phone: '5512345678', product },
      'tok-1',
    );
    expect(pendingReceipt.status).toBe('POR_CONFIRMAR');
    expect(pendingReceipt.applied).toBe(false);

    const rejectedReceipt = await repo.pay(
      { accountNumber: '9876543210', kind: 'RECARGA', phone: '5512345678', product },
      'tok-2',
    );
    expect(rejectedReceipt.status).toBe('RECHAZADO');
    expect(rejectedReceipt.applied).toBe(false);

    const refreshed = await repo.getPaymentStatus('UPC123456', pendingReceipt);
    expect(refreshed.status).toBe('APLICADO');
    expect(refreshed.applied).toBe(true);
    expect(refreshed.authorization).toBe('AUTH-OK-99');
    expect(refreshed.transactionId).toBe(777111);
  });

  it('Fase 6: createHistoryRepository consulta listado paginado con referencia enmascarada y detalle por id', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          content: [
            {
              id: 101,
              codigo: 1,
              mensaje: 'Pago aplicado',
              estado: 'APLICADO',
              tipoPago: 'SERVICIO',
              numCuenta: '9876543210',
              idServicio: 79,
              idProducto: 209,
              nombreServicio: 'CFE',
              nombreProducto: 'Luz CFE',
              referencia: '********7271',
              destinoEnmascarado: '********7271',
              monto: 150,
              numAutorizacion: 'AUTH-CFE-01',
              idTx: 555001,
              upc: 'UPCCFE001',
              fechaCreacion: '2026-11-15T12:00:00Z',
            },
          ],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
          last: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 101,
          codigo: 1,
          mensaje: 'Pago aplicado',
          estado: 'APLICADO',
          tipoPago: 'SERVICIO',
          numCuenta: '9876543210',
          idServicio: 79,
          idProducto: 209,
          nombreServicio: 'CFE',
          nombreProducto: 'Luz CFE',
          referencia: '40425475190118187271',
          destinoEnmascarado: '********7271',
          monto: 150,
          numAutorizacion: 'AUTH-CFE-01',
          idTx: 555001,
          upc: 'UPCCFE001',
          fechaCreacion: '2026-11-15T12:00:00Z',
        },
      });

    const historyRepo = createHistoryRepository({ get } as unknown as AxiosInstance);

    const pageRes = await historyRepo.getHistory({ estado: 'APLICADO', page: 0, size: 10 });
    expect(get).toHaveBeenCalledWith('/v1/pagos', {
      params: { estado: 'APLICADO', page: 0, size: 10 },
    });
    expect(pageRes.totalElements).toBe(1);
    expect(pageRes.items[0]?.maskedDestination).toBe('********7271');
    expect(pageRes.items[0]?.applied).toBe(true);

    const detail = await historyRepo.getHistoryDetail('101');
    expect(get).toHaveBeenCalledWith('/v1/pagos/101');
    expect(detail.fullDestination).toBe('40425475190118187271');
    expect(detail.authorization).toBe('AUTH-CFE-01');
  });
});
