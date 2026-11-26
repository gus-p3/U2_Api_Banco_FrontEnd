import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSessionStore } from '@/features/auth/presentation/sessionStore';

import {
  approveRemoteAuthorization,
  getPendingRemoteAuthorizations,
  getRemoteAuthorizationStatus,
  rejectRemoteAuthorization,
  requestRemotePaymentAuth,
} from '../data/authorizationRepository';
import { paymentsRepository } from '../data/paymentsRepository';
import { receiptStore, selectedProductStore } from './hooks';
import { PaymentCheckoutScreen } from './PaymentCheckoutScreen';
import { RemoteAuthListener } from './RemoteAuthListener';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/features/accounts/presentation/hooks', () => ({
  accountKeys: {
    customer: ['customer'],
    movements: (n: string) => ['movements', n],
  },
  useAccounts: () => ({
    accounts: [
      {
        id: 1,
        number: '8336580575',
        type: 'DEBITO',
        status: 'ACTIVA',
        balance: 1500,
      },
    ],
  }),
}));

const mockConfirmFingerprint = jest.fn();
const mockBioAvailable = jest.fn();
jest.mock('@/features/auth/presentation/authActions', () => ({
  confirmPaymentWithFingerprint: () => mockConfirmFingerprint(),
  isBiometricConfirmationAvailable: () => mockBioAvailable(),
}));

jest.mock('../data/authorizationRepository', () => {
  const actual = jest.requireActual('../data/authorizationRepository');
  return {
    ...actual,
    registerPushToken: jest.fn().mockResolvedValue(undefined),
    requestRemotePaymentAuth: jest.fn(),
    getPendingRemoteAuthorizations: jest.fn(),
    getRemoteAuthorizationStatus: jest.fn(),
    approveRemoteAuthorization: jest.fn(),
    rejectRemoteAuthorization: jest.fn(),
    cancelRemoteAuthorization: jest.fn().mockResolvedValue({}),
  };
});

jest.mock('../data/paymentsRepository', () => ({
  paymentsRepository: {
    getProducts: jest.fn(),
    validateReference: jest.fn(),
    pay: jest.fn(),
    getPaymentStatus: jest.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}

const PENDING_AUTH = {
  idAutorizacion: 'auth-web-123',
  estado: 'PENDIENTE' as const,
  tipoPago: 'RECARGA' as const,
  numCuenta: '8336580575',
  idServicio: 133,
  idProducto: 582,
  nombreServicio: 'Telcel',
  nombreProducto: 'Telcel 100',
  destinoEnmascarado: '******5678',
  monto: 100,
  expiraEn: new Date(Date.now() + 120_000).toISOString(),
};

describe('Flujo E2E Autorización Remota Web -> Android con Huella', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    receiptStore.clear();
    useSessionStore.setState({ status: 'authenticated' });
    mockBioAvailable.mockResolvedValue(true);
    mockConfirmFingerprint.mockResolvedValue('confirm-token-huella-xyz');
    (paymentsRepository.getProducts as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'Telcel 100',
        serviceName: 'Telcel',
        idServicio: 133,
        idProducto: 582,
        kind: 'RECARGA',
        category: 'Recargas',
        price: 100,
        hasCheckDigit: false,
        helpAvailable: false,
      },
    ]);
  });

  afterEach(() => {
    Platform.OS = 'android';
  });

  it('Web solicita pago, espera confirmación y navega al comprobante al aprobarse desde Android', async () => {
    Platform.OS = 'web';
    selectedProductStore.set({
      id: 1,
      name: 'Telcel 100',
      serviceName: 'Telcel',
      idServicio: 133,
      idProducto: 582,
      kind: 'RECARGA',
      category: 'Recargas',
      price: 100,
      hasCheckDigit: false,
      helpAvailable: false,
    });
    (requestRemotePaymentAuth as jest.Mock).mockResolvedValue(PENDING_AUTH);
    (getRemoteAuthorizationStatus as jest.Mock).mockResolvedValue({
      ...PENDING_AUTH,
      estado: 'APROBADO',
      resultadoPago: {
        codigo: 0,
        estado: 'RECHAZADO',
        codigoGestoPago: '05',
        mensaje: 'No se puede procesar el pago por el momento, intente más tarde',
        upc: 'UPC-WEB-05',
      },
    });

    await render(
      <Wrapper>
        <PaymentCheckoutScreen />
      </Wrapper>,
    );

    await fireEvent.changeText(
      await screen.findByLabelText('Número de teléfono (10 dígitos)'),
      '5512345678',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar autorización a mi celular' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Enviar notificación a mi Android' }));

    expect(requestRemotePaymentAuth).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Esperando autorización en tu celular')).toBeTruthy();

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/payment/receipt');
      },
      { timeout: 4000 },
    );

    const receipt = receiptStore.get();
    expect(receipt?.status).toBe('RECHAZADO');
    expect(receipt?.gatewayCode).toBe('05');
    expect(receipt?.upc).toBe('UPC-WEB-05');
    expect(receipt?.message).toContain('No se puede procesar el pago por el momento');
  }, 15000);

  it('Android detecta autorización pendiente, muestra modal y aprueba con huella digital', async () => {
    Platform.OS = 'android';
    (getPendingRemoteAuthorizations as jest.Mock).mockResolvedValue([PENDING_AUTH]);
    (approveRemoteAuthorization as jest.Mock).mockResolvedValue({
      ...PENDING_AUTH,
      estado: 'APROBADO',
      resultadoPago: {
        codigo: 0,
        estado: 'RECHAZADO',
        codigoGestoPago: '05',
        mensaje: 'No se puede procesar el pago por el momento, intente más tarde',
        upc: 'UPC-WEB-05',
      },
    });

    await render(
      <Wrapper>
        <RemoteAuthListener />
      </Wrapper>,
    );

    expect(await screen.findByText('¿Autorizas este pago desde Web?')).toBeTruthy();
    expect(screen.getByText('Telcel')).toBeTruthy();
    expect(screen.getByText('Telcel 100')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Autorizar con huella digital' }));

    await waitFor(() => {
      expect(mockConfirmFingerprint).toHaveBeenCalledTimes(1);
      expect(approveRemoteAuthorization).toHaveBeenCalledWith(
        'auth-web-123',
        'confirm-token-huella-xyz',
      );
    });
  });

  it('Android permite rechazar una solicitud de pago iniciada desde Web', async () => {
    Platform.OS = 'android';
    (getPendingRemoteAuthorizations as jest.Mock).mockResolvedValue([PENDING_AUTH]);
    (rejectRemoteAuthorization as jest.Mock).mockResolvedValue({
      ...PENDING_AUTH,
      estado: 'RECHAZADO',
    });

    await render(
      <Wrapper>
        <RemoteAuthListener />
      </Wrapper>,
    );

    expect(await screen.findByText('¿Autorizas este pago desde Web?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rechazar pago' }));

    await waitFor(() => {
      expect(rejectRemoteAuthorization).toHaveBeenCalledWith('auth-web-123');
    });
  });
});
