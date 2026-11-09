import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { LoginScreen } from '@/features/auth/presentation/LoginScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Flujo de pantalla de Login', () => {
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
});
