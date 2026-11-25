import type { AxiosInstance } from 'axios';

import { toAppError } from '@/core/errors/toAppError';
import { createHttpClient } from '@/core/http/client';
import {
  validateAdultBirthDate,
  validateDateRange,
  validatePaymentAmount,
  validatePhone10,
  validateSearchQuery,
  validateServiceReference,
} from '@/core/validation/validators';
import { createAccountsRepository } from '@/features/accounts/data/accountsRepository';
import { getRecentMovements, totalBalance } from '@/features/accounts/domain/repository';
import { createAuthRepository } from '@/features/auth/data/authRepository';
import { loginWithBiometrics, loginWithPassword } from '@/features/auth/domain/usecases';
import { loginSchema } from '@/features/auth/presentation/loginSchema';
import { registerSchema } from '@/features/auth/presentation/registerSchema';
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

describe('Casos de uso y repositorios (Auth, Cuentas, Validaciones y Pagos solo en móvil con huella)', () => {
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

    expect(post).not.toHaveBeenCalled();
    const movs = await repo.getMovements('8336580575');
    expect(movs).toHaveLength(1);
    expect(movs[0]?.type).toBe('APERTURA');
    expect(movs[0]?.signedAmount).toBe(25000);
  });

  it('payProduct bloquea pagos en Web (UNSUPPORTED_PLATFORM) y exige exclusivamente huella digital en móvil', async () => {
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
    const confirmWithFingerprint = jest.fn(async () => 'confirm-token-bio');
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

    // 1. En Web está estrictamente prohibido pagar -> UNSUPPORTED_PLATFORM
    await expect(
      payProduct(
        {
          repo,
          confirmWithFingerprint,
          isMobilePlatform: () => false,
        },
        {
          accountNumber: '9876543210',
          kind: 'RECARGA',
          phone: '5512345678',
          useBiometricConfirmation: true,
          product,
        },
      ),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PLATFORM' });
    expect(post).not.toHaveBeenCalled();

    // 2. En móvil sin confirmación de huella -> STRONG_AUTH_REQUIRED
    await expect(
      payProduct(
        {
          repo,
          confirmWithFingerprint,
          isMobilePlatform: () => true,
        },
        {
          accountNumber: '9876543210',
          kind: 'RECARGA',
          phone: '5512345678',
          product,
        },
      ),
    ).rejects.toMatchObject({ code: 'STRONG_AUTH_REQUIRED' });

    // 3. En móvil con huella digital -> envía X-Confirmation-Token y aplica el pago
    const receipt = await payProduct(
      {
        repo,
        confirmWithFingerprint,
        isMobilePlatform: () => true,
      },
      {
        accountNumber: '9876543210',
        kind: 'RECARGA',
        phone: '5512345678',
        useBiometricConfirmation: true,
        product,
      },
    );

    expect(confirmWithFingerprint).toHaveBeenCalledTimes(1);
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
        headers: { 'X-Confirmation-Token': 'confirm-token-bio' },
      },
    );
    expect(receipt.applied).toBe(true);
    expect(receipt.authorization).toBe('AUTH123');
  });

  it('getProducts devuelve vacío si el backend devuelve vacío y mapea legend, categoría y logoUrl por idServicio', async () => {
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
    expect(items[0]?.logoUrl).toBe(
      'https://gestopago.portalventas.net/sistema/images/gestopago/servicios/133.png',
    );
  });

  it('validateReference distingue referencia válida, inválida y bloquea pago de servicio sin validar', async () => {
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

    const invalidRes = await repo.validateReference({
      idServicio: 79,
      idProducto: 209,
      reference: '0000000000',
      amount: 150,
    });
    expect(invalidRes.valid).toBe(false);

    await expect(
      payProduct(
        {
          repo,
          confirmWithFingerprint: async () => 'confirm-tok',
          isMobilePlatform: () => true,
        },
        {
          accountNumber: '9876543210',
          kind: 'SERVICIO',
          reference: '998877665544',
          amount: 150,
          referenceValidated: false,
          useBiometricConfirmation: true,
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

  it('mapea código 05 de GestoPago (gatewayCode) y refresca comprobantes POR_CONFIRMAR', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          codigo: 0,
          mensaje: 'Pago en proceso de confirmación',
          estado: 'POR_CONFIRMAR',
          upc: 'UPC123456',
        },
      })
      .mockResolvedValueOnce({
        data: {
          codigo: 0,
          mensaje: 'GestoPago rechazó la operación (código 05 - restricción de origen/IP del proveedor: Origen Valido).',
          estado: 'RECHAZADO',
          codigoGestoPago: '05',
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

    const code05Receipt = await repo.pay(
      { accountNumber: '9876543210', kind: 'RECARGA', phone: '5512345678', product },
      'tok-2',
    );
    expect(code05Receipt.status).toBe('RECHAZADO');
    expect(code05Receipt.gatewayCode).toBe('05');
    expect(code05Receipt.applied).toBe(false);

    const refreshed = await repo.getPaymentStatus('UPC123456', pendingReceipt);
    expect(refreshed.status).toBe('APLICADO');
    expect(refreshed.applied).toBe(true);
    expect(refreshed.authorization).toBe('AUTH-OK-99');
  });

  it('createHistoryRepository consulta listado paginado y detalle por id', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          content: [
            {
              id: 101,
              codigo: 0,
              mensaje: 'Rechazado código 05',
              estado: 'RECHAZADO',
              codigoGestoPago: '05',
              tipoPago: 'SERVICIO',
              numCuenta: '9876543210',
              idServicio: 79,
              idProducto: 209,
              nombreServicio: 'CFE',
              nombreProducto: 'Luz CFE',
              referencia: '********7271',
              destinoEnmascarado: '********7271',
              monto: 150,
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
          codigo: 0,
          mensaje: 'Rechazado código 05',
          estado: 'RECHAZADO',
          codigoGestoPago: '05',
          tipoPago: 'SERVICIO',
          numCuenta: '9876543210',
          idServicio: 79,
          idProducto: 209,
          nombreServicio: 'CFE',
          nombreProducto: 'Luz CFE',
          referencia: '40425475190118187271',
          destinoEnmascarado: '********7271',
          monto: 150,
          upc: 'UPCCFE001',
          fechaCreacion: '2026-11-15T12:00:00Z',
        },
      });

    const historyRepo = createHistoryRepository({ get } as unknown as AxiosInstance);

    const pageRes = await historyRepo.getHistory({ estado: 'RECHAZADO', page: 0, size: 10 });
    expect(pageRes.items[0]?.gatewayCode).toBe('05');
    expect(pageRes.items[0]?.maskedDestination).toBe('********7271');

    const detail = await historyRepo.getHistoryDetail('101');
    expect(detail.fullDestination).toBe('40425475190118187271');
    expect(detail.gatewayCode).toBe('05');
  });

  it('valida exhaustivamente todos los campos de búsqueda, fechas, montos, referencias, login y registro', () => {
    expect(validateSearchQuery('Telcel 100')).toBeUndefined();
    expect(validateSearchQuery('<script>alert(1)</script>')).toBeDefined();

    // Fechas reales y rangos
    expect(validateDateRange('2026-02-29', '').desdeError).toBeDefined(); // 2026 no es bisiesto
    expect(validateDateRange('2024-02-29', '').desdeError).toBeUndefined(); // 2024 sí es bisiesto
    expect(validateDateRange('2026-06-10', '2026-06-01').hastaError).toContain('anterior');

    // Mayoría de edad
    expect(validateAdultBirthDate('2015-05-15')).toContain('18 años');
    expect(validateAdultBirthDate('1995-05-15')).toBeUndefined();

    // Teléfono, referencia y monto
    expect(validatePhone10('0000000000')).toContain('ceros');
    expect(validatePhone10('5512345678')).toBeUndefined();
    expect(
      validateServiceReference('1111111111', { hasCheckDigit: true, referenceType: '10 dígitos' }),
    ).toContain('verificador');
    expect(
      validateServiceReference('9876543210', { hasCheckDigit: true, referenceType: '10 dígitos' }),
    ).toBeUndefined();
    expect(validatePaymentAmount('150.555')).toBeDefined();
    expect(validatePaymentAmount('500', { maxBalance: 200 })).toContain('saldo disponible');
    expect(validatePaymentAmount('150.50', { maxBalance: 500 })).toBeUndefined();

    // Esquemas Zod de login y registro
    expect(loginSchema.safeParse({ email: 'malo', password: '123' }).success).toBe(false);
    expect(
      registerSchema.safeParse({
        name: 'Alejandro123',
        lastName: 'Hernández',
        birthDate: '1995-05-15',
        curp: 'HERA950515HDFRND01',
        rfc: 'HERA950515ABC',
        idGender: 1,
        idNationality: 1,
        idMaritalStatus: 1,
        email: 'alejandro@banco.com',
        mobilePhone: '5512345678',
        street: 'Av Reforma',
        exteriorNumber: '222',
        neighborhood: 'Juárez',
        claveEntidad: '09',
        idMunicipality: 1,
        postalCode: '06600',
        occupation: 'Ingeniero',
        company: 'Banco Digital',
        monthlyIncome: '25000.00',
        password: 'PasswordSegura#2026',
      }).success,
    ).toBe(false);
  });
});
