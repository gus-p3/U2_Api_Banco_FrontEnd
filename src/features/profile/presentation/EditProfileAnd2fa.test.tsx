import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoginScreen } from '@/features/auth/presentation/LoginScreen';
import { EditProfileScreen } from '@/features/profile/presentation/EditProfileScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/features/accounts/presentation/hooks', () => ({
  accountKeys: { customer: ['customer'] },
  useCustomer: () => ({
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    data: {
      fullName: 'Brandon Gustavo Pérez López',
      firstName: 'Brandon',
      secondName: 'Gustavo',
      lastName: 'Pérez',
      secondLastName: 'López',
      email: 'brandon@banco.com',
      mobilePhone: '5512345678',
      alternativePhone: '',
      curp: 'HERA950515HDFRND01',
      rfc: 'HERA950515ABC',
      genderId: 1,
      genderName: 'Masculino',
      nationalityId: 1,
      nationalityName: 'Mexicana',
      maritalStatusId: 2,
      maritalStatusName: 'Casado',
      isActive: true,
      accounts: [],
      street: 'Av. Vallarta',
      exteriorNumber: '100',
      interiorNumber: '',
      neighborhood: 'Americana',
      municipalityId: 201,
      municipalityName: 'Guadalajara',
      stateId: 14,
      stateCode: '14',
      stateName: 'Jalisco',
      postalCode: '44160',
      occupation: 'Desarrollador(a) / Ingeniero(a) de software',
      professionId: 1,
      professionName: 'Desarrollador(a) / Ingeniero(a) de software',
      operationAmountId: 2,
      operationAmountLabel: '$5,001 a $10,000 MXN',
      operationAmountMax: 10000,
      company: 'Banco Digital',
      monthlyIncome: 30000,
    },
  }),
}));

jest.mock('@/features/catalogs/presentation/hooks', () => ({
  useGenders: () => ({
    data: [
      { id: 1, name: 'Masculino' },
      { id: 2, name: 'Femenino' },
    ],
    isLoading: false,
  }),
  useNationalities: () => ({ data: [{ id: 1, name: 'Mexicana' }], isLoading: false }),
  useMaritalStatuses: () => ({
    data: [
      { id: 1, name: 'Soltero' },
      { id: 2, name: 'Casado' },
    ],
    isLoading: false,
  }),
  useStates: () => ({
    data: [
      { id: 9, code: '09', name: 'Ciudad de México' },
      { id: 14, code: '14', name: 'Jalisco' },
    ],
    isLoading: false,
  }),
  useMunicipalities: (code?: string) => ({
    data: code === '14' ? [{ id: 201, stateId: 14, code: '039', name: 'Guadalajara' }] : [],
    isLoading: false,
  }),
  useProfessions: () => ({
    data: [{ id: 1, name: 'Desarrollador(a) / Ingeniero(a) de software' }],
    isLoading: false,
  }),
  useOperationAmounts: () => ({
    data: [{ id: 2, label: '$5,001 a $10,000 MXN', minAmount: 5000.01, maxAmount: 10000 }],
    isLoading: false,
  }),
}));

const mockSignInWithPasswordChallenge = jest.fn();

jest.mock('@/features/auth/presentation/authActions', () => ({
  signInWithPasswordChallenge: (...args: unknown[]) => mockSignInWithPasswordChallenge(...args),
  signInWithBiometrics: jest.fn(),
  verifyEmailOrLoginCode: jest.fn(),
  send2faEmailCode: jest.fn(),
  request2faMobileFingerprint: jest.fn(),
  poll2faChallengeStatus: jest.fn(),
  cancel2faChallenge: jest.fn(),
}));

jest.mock('@/features/auth/di', () => ({
  authDeps: {
    biometrics: { isAvailable: jest.fn().mockResolvedValue(false) },
    store: {
      getLastEmail: jest.fn().mockResolvedValue(null),
      getBiometricSecret: jest.fn().mockResolvedValue(null),
    },
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

describe('EditProfileScreen y Login 2FA Web', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    mockSignInWithPasswordChallenge.mockReset();
  });

  it('EditProfileScreen precarga los catálogos seleccionados y valida campos al momento', async () => {
    await render(
      <Wrapper>
        <EditProfileScreen />
      </Wrapper>,
    );

    expect(await screen.findByText('Jalisco')).toBeTruthy();
    expect(screen.getByText('Guadalajara')).toBeTruthy();
    expect(screen.getByText('Masculino')).toBeTruthy();
    expect(screen.getByText('Mexicana')).toBeTruthy();
    expect(screen.getByText('Casado')).toBeTruthy();

    const emailInput = screen.getByLabelText('Correo electrónico');
    await fireEvent.changeText(emailInput, 'correo-malo');
    expect(await screen.findByText('El formato del correo electrónico es inválido')).toBeTruthy();

    const phoneInput = screen.getByLabelText('Teléfono móvil (10 dígitos)');
    await fireEvent.changeText(phoneInput, '1234');
    expect(await screen.findByText('El teléfono móvil debe tener exactamente 10 dígitos')).toBeTruthy();
  });

  it('LoginScreen en Web ofrece las 2 opciones: enviar código por correo o autorizar con huella del teléfono', async () => {
    Platform.OS = 'web';
    mockSignInWithPasswordChallenge.mockResolvedValue({
      kind: 'challenge',
      challenge: {
        email: 'brandon@banco.com',
        purpose: 'LOGIN_2FA',
        challengeId: 'ch-1',
        pollToken: 'pt-1',
        availableMethods: ['EMAIL_CODE', 'MOBILE_BIOMETRIC'],
        codeSent: false,
        hasBiometricRegistered: true,
        expiresInSeconds: 300,
      },
    });

    await render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>,
    );

    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'brandon@banco.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'PasswordSegura#2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Confirma tu inicio de sesión')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar código a mi correo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Autorizar con la huella de mi teléfono' })).toBeTruthy();
  });
});
