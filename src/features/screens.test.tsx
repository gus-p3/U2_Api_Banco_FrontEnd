import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { LoginScreen } from '@/features/auth/presentation/LoginScreen';
import { HistoryScreen } from '@/features/history/presentation/HistoryScreen';
import { CatalogScreen } from '@/features/payments/presentation/CatalogScreen';
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

describe('Flujo de pantallas UI (Login, Catálogo, Comprobante y Historial)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    receiptStore.clear();
  });

  it('renderiza LoginScreen y autocompleta las credenciales demo al presionar Usar credenciales demo', async () => {
    await render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>,
    );

    expect(screen.getByText('Banco Digital')).toBeTruthy();
    const demoBtn = screen.getByRole('button', { name: 'Usar credenciales demo' });
    await fireEvent.press(demoBtn);

    expect(screen.getByLabelText('Correo electrónico').props.value).toBe(
      'alejandro.hernandez@banco-demo.com',
    );
    expect(screen.getByLabelText('Contraseña').props.value).toBe('PasswordSegura#2026');
  });

  it('renderiza CatalogScreen con categorías, búsqueda y navegación a pagos', async () => {
    await render(
      <Wrapper>
        <CatalogScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('Telcel 100')).toBeTruthy();
    expect(screen.getByText('Luz CFE')).toBeTruthy();
    expect(screen.getByText('Ingresa los 10 dígitos de tu línea Telcel')).toBeTruthy();

    const payServiceBtn = screen.getByRole('button', { name: 'Pagar este servicio' });
    await fireEvent.press(payServiceBtn);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/payments',
      params: { tab: 'SERVICIO', productId: '209', serviceId: '79' },
    });
  });

  it('ReceiptScreen diferencia visual y textualmente POR_CONFIRMAR, APLICADO y RECHAZADO', async () => {
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
    expect(screen.getByText('Pago en proceso de confirmación')).toBeTruthy();
    expect(screen.getByText('Operación aún no confirmada como aplicada')).toBeTruthy();

    const refreshBtn = screen.getByRole('button', { name: 'Actualizar estado del pago' });
    await fireEvent.press(refreshBtn);

    expect(await screen.findByText('Pago aplicado exitosamente')).toBeTruthy();
    expect(screen.getByText('AUTH-FINAL-1')).toBeTruthy();
    await unmount();

    receiptStore.set({
      id: 46,
      message: 'Referencia vencida',
      status: 'RECHAZADO',
      applied: false,
      upc: 'UPC-REJ-02',
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
    expect(screen.getByText('Pago rechazado')).toBeTruthy();
    expect(screen.getByText('Transacción no aplicada')).toBeTruthy();
  });

  it('HistoryScreen muestra listado paginado con referencia enmascarada y navega al detalle', async () => {
    await render(
      <Wrapper>
        <HistoryScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('CFE · Luz CFE')).toBeTruthy();
    expect(screen.getByText('Ref: ********5160')).toBeTruthy();

    const itemBtn = screen.getByRole('button', { name: 'Ver detalle de CFE Luz CFE' });
    await fireEvent.press(itemBtn);

    expect(mockPush).toHaveBeenCalledWith('/payment/101');
  });
});
