import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { LoginScreen } from '@/features/auth/presentation/LoginScreen';
import { HistoryScreen } from '@/features/history/presentation/HistoryScreen';
import { CatalogScreen } from '@/features/payments/presentation/CatalogScreen';
import { PaymentsScreen } from '@/features/payments/presentation/PaymentsScreen';
import { receiptStore } from '@/features/payments/presentation/hooks';
import { ReceiptScreen } from '@/features/payments/presentation/ReceiptScreen';

jest.setTimeout(15000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/features/auth/di', () => ({
  authDeps: {
    biometrics: {
      isAvailable: jest.fn().mockResolvedValue(false),
      authenticate: jest.fn().mockResolvedValue(true),
      generateSecret: jest.fn().mockResolvedValue('sec'),
    },
    store: {
      getLastEmail: jest.fn().mockResolvedValue(null),
      getBiometricSecret: jest.fn().mockResolvedValue(null),
      saveLastEmail: jest.fn().mockResolvedValue(undefined),
      saveRefreshToken: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('@/features/accounts/presentation/hooks', () => ({
  accountKeys: {
    customer: ['customer'],
    movements: (n: string) => ['movements', n],
  },
  useAccounts: () => ({
    accounts: [{ id: 1, number: '8336580575', balance: 25000, status: 'ACTIVA' }],
    total: 25000,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

jest.mock('@/features/payments/data/paymentsRepository', () => ({
  paymentsRepository: {
    getProducts: jest.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Telcel 100',
        serviceName: 'Telcel',
        idServicio: 133,
        idProducto: 582,
        kind: 'RECARGA',
        price: 100,
        hasCheckDigit: false,
        helpAvailable: false,
        description: 'Ingresa los 10 dígitos de tu línea Telcel',
        category: 'Recargas',
      },
      {
        id: 2,
        name: 'Luz CFE',
        serviceName: 'CFE',
        idServicio: 79,
        idProducto: 209,
        kind: 'SERVICIO',
        hasCheckDigit: true,
        helpAvailable: true,
        description: 'Captura los 12 o 30 dígitos de tu recibo CFE',
        category: 'Servicios',
      },
    ]),
    getPaymentStatus: jest.fn().mockResolvedValue({
      id: 45,
      message: 'Confirmado finalmente',
      status: 'APLICADO',
      applied: true,
      authorization: 'AUTH-FINAL-1',
      transactionId: 9001,
      upc: 'UPC-PEND-01',
      serviceName: 'CFE',
      productName: 'Luz CFE',
      destination: '979011005160',
      amount: 150,
      accountNumber: '8336580575',
      createdAt: '2026-11-15T12:00:00Z',
      kind: 'SERVICIO',
    }),
  },
}));

jest.mock('@/features/history/data/historyRepository', () => ({
  historyRepository: {
    getHistory: jest.fn().mockResolvedValue({
      items: [
        {
          id: 101,
          code: 1,
          message: 'Pago aplicado',
          status: 'APLICADO',
          applied: true,
          kind: 'SERVICIO',
          accountNumber: '8336580575',
          idServicio: 79,
          idProducto: 209,
          serviceName: 'CFE',
          productName: 'Luz CFE',
          maskedDestination: '********5160',
          amount: 150,
          authorization: 'AUTH-CFE-01',
          transactionId: 555001,
          upc: 'UPCCFE001',
          createdAt: '2026-11-15T12:00:00Z',
        },
      ],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      last: true,
    }),
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Flujo de pantallas UI (Login, Catálogo, Bloqueo Web de Pagos, Comprobante y Historial)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = originalOS;
    mockPush.mockClear();
    mockReplace.mockClear();
    receiptStore.clear();
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  it('renderiza LoginScreen, valida en tiempo real y autocompleta credenciales demo', async () => {
    await render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>,
    );

    expect(screen.getByText('Banco Digital')).toBeTruthy();
    const emailInput = screen.getByLabelText('Correo electrónico');
    await fireEvent.changeText(emailInput, 'correo-invalido');
    expect(await screen.findByText('El formato del correo electrónico es inválido')).toBeTruthy();

    const demoBtn = screen.getByRole('button', { name: 'Usar credenciales demo' });
    await fireEvent.press(demoBtn);

    expect(screen.getByLabelText('Correo electrónico').props.value).toBe(
      'alejandro.hernandez@banco-demo.com',
    );
    expect(screen.getByLabelText('Contraseña').props.value).toBe('PasswordSegura#2026');
  });

  it('renderiza CatalogScreen en móvil y en Web permitiendo iniciar el flujo de pagos', async () => {
    Platform.OS = 'android';
    const { unmount } = await render(
      <Wrapper>
        <CatalogScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('Telcel 100')).toBeTruthy();
    const payServiceBtn = screen.getByRole('button', { name: 'Pagar este servicio' });
    await fireEvent.press(payServiceBtn);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/payment/checkout',
      params: { tab: 'SERVICIO', productId: '209', serviceId: '79' },
    });
    await unmount();

    Platform.OS = 'web';
    await render(
      <Wrapper>
        <CatalogScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('Telcel 100')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagar este servicio' })).toBeTruthy();
  });

  it('PaymentsScreen navega a la pantalla dedicada de checkout al seleccionar un servicio', async () => {
    Platform.OS = 'web';
    await render(
      <Wrapper>
        <PaymentsScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('Telcel · Telcel 100')).toBeTruthy();
    await fireEvent.press(screen.getByText('Telcel · Telcel 100'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/payment/checkout',
      params: { tab: 'RECARGA', productId: '582', serviceId: '133' },
    });
  });

  it('ReceiptScreen muestra POR_CONFIRMAR, APLICADO y maneja el rechazo con código 05 de GestoPago', async () => {
    receiptStore.set({
      id: 45,
      message: 'En espera de confirmación del proveedor',
      status: 'POR_CONFIRMAR',
      applied: false,
      upc: 'UPC-PEND-01',
      serviceName: 'CFE',
      productName: 'Luz CFE',
      destination: '979011005160',
      amount: 150,
      accountNumber: '8336580575',
      createdAt: '2026-11-15T12:00:00Z',
      kind: 'SERVICIO',
    });

    const { unmount } = await render(
      <Wrapper>
        <ReceiptScreen />
      </Wrapper>,
    );

    expect(screen.getByText('POR CONFIRMAR')).toBeTruthy();
    const refreshBtn = screen.getByRole('button', { name: 'Actualizar estado del pago' });
    await fireEvent.press(refreshBtn);

    expect(await screen.findByText('Pago aplicado exitosamente')).toBeTruthy();
    expect(screen.getByText('AUTH-FINAL-1')).toBeTruthy();
    await unmount();

    receiptStore.set({
      id: 46,
      message: 'No se puede procesar el pago por el momento, intente más tarde',
      status: 'RECHAZADO',
      applied: false,
      gatewayCode: '05',
      upc: 'UPC-REJ-05',
      serviceName: 'CFE',
      productName: 'Luz CFE',
      destination: '979011005160',
      amount: 150,
      accountNumber: '8336580575',
      createdAt: '2026-11-15T12:05:00Z',
      kind: 'SERVICIO',
    });

    await render(
      <Wrapper>
        <ReceiptScreen />
      </Wrapper>,
    );

    expect(screen.getByText('RECHAZADO')).toBeTruthy();
    expect(screen.getByText('05')).toBeTruthy();
    expect(
      screen.getByText('No se puede procesar el pago por el momento, intente más tarde'),
    ).toBeTruthy();
  });

  it('HistoryScreen valida fechas en tiempo real y muestra listado paginado', async () => {
    await render(
      <Wrapper>
        <HistoryScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('CFE · Luz CFE')).toBeTruthy();
    const desdeInput = screen.getByLabelText('Desde (AAAA-MM-DD)');
    await fireEvent.changeText(desdeInput, '2026-99-99');
    expect(
      screen.getByText('La fecha inicial no corresponde a una fecha real del calendario.'),
    ).toBeTruthy();

    await fireEvent.changeText(desdeInput, '');
    const itemBtn = screen.getByRole('button', { name: 'Ver detalle de CFE Luz CFE' });
    await fireEvent.press(itemBtn);
    expect(mockPush).toHaveBeenCalledWith('/payment/101');
  });
});
