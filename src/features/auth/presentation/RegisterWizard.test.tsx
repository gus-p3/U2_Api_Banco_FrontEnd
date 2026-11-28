import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RegisterScreen } from './RegisterScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
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
  useMaritalStatuses: () => ({ data: [{ id: 1, name: 'Soltero' }], isLoading: false }),
  useStates: () => ({
    data: [
      { code: '09', name: 'Ciudad de México' },
      { code: '14', name: 'Jalisco' },
    ],
    isLoading: false,
  }),
  useMunicipalities: (code?: string) => ({
    data:
      code === '09'
        ? [{ id: 101, name: 'Cuauhtémoc' }]
        : code === '14'
          ? [{ id: 201, name: 'Guadalajara' }]
          : [],
    isLoading: false,
  }),
  useProfessions: () => ({
    data: [
      { id: 1, name: 'Desarrollador(a) / Ingeniero(a) de software' },
      { id: 2, name: 'Comerciante' },
    ],
    isLoading: false,
  }),
  useOperationAmounts: () => ({
    data: [
      { id: 1, label: 'Hasta $5,000 MXN', minAmount: 0.01, maxAmount: 5000 },
      { id: 2, label: '$5,001 a $10,000 MXN', minAmount: 5000.01, maxAmount: 10000 },
    ],
    isLoading: false,
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe('RegisterScreen Wizard (4 nombres, auto CURP/RFC, autofill seguro, profesiones y monto operación)', () => {
  it('avanza los 4 pasos calculando CURP y RFC automáticamente y bloqueando autofill en CURP/RFC', async () => {
    await render(
      <Wrapper>
        <RegisterScreen />
      </Wrapper>,
    );

    // Paso 1
    expect(screen.getByText('Paso 1 de 4 · Datos personales')).toBeTruthy();

    // Abre calendario y verifica que no ofrece el año actual (menor de edad bloqueado)
    await fireEvent.press(screen.getByRole('button', { name: 'Fecha de nacimiento' }));
    expect(screen.getByText(/Fecha máxima permitida \(18 años\)/)).toBeTruthy();
    await fireEvent.press(screen.getByText('15'));

    // Llena los 4 campos de nombre (segundo nombre y apellido materno opcionales, máx 62)
    await fireEvent.changeText(screen.getByLabelText('Primer nombre'), 'Alejandro123!');
    expect(screen.getByLabelText('Primer nombre').props.value).toBe('Alejandro');
    await fireEvent.changeText(screen.getByLabelText('Segundo nombre (opcional)'), 'Carlos');
    await fireEvent.changeText(screen.getByLabelText('Apellido paterno'), 'Hernández99');
    expect(screen.getByLabelText('Apellido paterno').props.value).toBe('Hernández');
    await fireEvent.changeText(screen.getByLabelText('Apellido materno (opcional)'), 'García');

    await fireEvent.press(screen.getByRole('button', { name: 'Género' }));
    await fireEvent.press(await screen.findByText('Masculino'));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Entidad de nacimiento (para calcular CURP)' }),
    );
    await fireEvent.press(await screen.findByText('Ciudad de México'));

    await fireEvent.press(screen.getByRole('button', { name: 'Nacionalidad' }));
    await fireEvent.press(await screen.findByText('Mexicana'));

    await fireEvent.press(screen.getByRole('button', { name: 'Estado civil' }));
    await fireEvent.press(await screen.findByText('Soltero'));

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 2: CURP y RFC ya llegan precalculados automáticamente y con autofill deshabilitado
    expect(await screen.findByText('Paso 2 de 4 · Identificación y contacto')).toBeTruthy();
    const curpInput = screen.getByLabelText('CURP (18 caracteres)');
    const rfcInput = screen.getByLabelText('RFC (12 o 13 caracteres)');
    expect(curpInput.props.value).toHaveLength(18);
    expect(rfcInput.props.value).toHaveLength(13);
    expect(curpInput.props.importantForAutofill).toBe('no');
    expect(rfcInput.props.importantForAutofill).toBe('no');

    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nuevo@banco-demo.com');
    await fireEvent.changeText(screen.getByLabelText('Teléfono celular (10 dígitos)'), '5512345678');

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 3: Domicilio
    expect(await screen.findByText('Paso 3 de 4 · Domicilio')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entidad federativa (Estado)' }));
    await fireEvent.press(await screen.findByText('Jalisco'));

    await waitFor(() => {
      expect(screen.queryByText(/municipio debe ser positivo/i)).toBeNull();
      expect(screen.queryByText(/municipio es obligatorio/i)).toBeNull();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Municipio o Alcaldía' }));
    await fireEvent.press(await screen.findByText('Guadalajara'));
    expect(screen.getByText('Guadalajara')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Calle'), 'Av. Vallarta');
    await fireEvent.changeText(screen.getByLabelText('Número exterior'), '100');
    await fireEvent.changeText(screen.getByLabelText('Colonia'), 'Americana');
    await fireEvent.changeText(screen.getByLabelText('Código postal (5 dígitos)'), '44160');

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 4: Catálogo de profesiones + rangos de monto de operación + checklist en vivo
    expect(await screen.findByText('Paso 4 de 4 · Empleo, monto de operación y seguridad')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Profesión / Ocupación' }));
    await fireEvent.press(await screen.findByText('Desarrollador(a) / Ingeniero(a) de software'));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Monto de operación (rango mensual y límite por pago)' }),
    );
    await fireEvent.press(await screen.findByText('$5,001 a $10,000 MXN'));

    expect(screen.getByText('Requisitos de seguridad')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'PasswordSegura#2026');
    await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'OtraClave#2026');
    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'PasswordSegura#2026');
    expect(screen.getByText('Las contraseñas coinciden')).toBeTruthy();
  });
});
