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

describe('RegisterScreen Wizard (calendario >=18, listas de catálogos, sin error prematuro de municipio)', () => {
  it('avanza paso a paso, abre calendario con años de menores bloqueados y no muestra error de municipio al cambiar estado', async () => {
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
    // Selecciona el día 15 del mes mostrado (1995)
    await fireEvent.press(screen.getByText('15'));

    // Llena paso 1 usando listas desplegables (nombre bloquea números y símbolos)
    await fireEvent.changeText(screen.getByLabelText('Nombre(s)'), 'Alejandro123!');
    expect(screen.getByLabelText('Nombre(s)').props.value).toBe('Alejandro');
    await fireEvent.changeText(screen.getByLabelText('Apellidos'), 'Hernández99');
    expect(screen.getByLabelText('Apellidos').props.value).toBe('Hernández');

    await fireEvent.press(screen.getByRole('button', { name: 'Género' }));
    await fireEvent.press(await screen.findByText('Masculino'));

    await fireEvent.press(screen.getByRole('button', { name: 'Nacionalidad' }));
    await fireEvent.press(await screen.findByText('Mexicana'));

    await fireEvent.press(screen.getByRole('button', { name: 'Estado civil' }));
    await fireEvent.press(await screen.findByText('Soltero'));

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 2: CURP y RFC bloquean caracteres especiales
    expect(await screen.findByText('Paso 2 de 4 · Identificación y contacto')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('CURP (18 caracteres)'), 'HERA-950515@HDFRND01');
    expect(screen.getByLabelText('CURP (18 caracteres)').props.value).toBe('HERA950515HDFRND01');
    await fireEvent.changeText(screen.getByLabelText('RFC (12 o 13 caracteres)'), 'HERA#950515!ABC');
    expect(screen.getByLabelText('RFC (12 o 13 caracteres)').props.value).toBe('HERA950515ABC');
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nuevo@banco-demo.com');
    await fireEvent.changeText(screen.getByLabelText('Teléfono celular (10 dígitos)'), '5512345678');

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 3: Domicilio
    expect(await screen.findByText('Paso 3 de 4 · Domicilio')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entidad federativa (Estado)' }));
    await fireEvent.press(await screen.findByText('Jalisco'));

    // Al elegir estado NO debe salir error prematuro de municipio
    await waitFor(() => {
      expect(screen.queryByText(/municipio debe ser positivo/i)).toBeNull();
      expect(screen.queryByText(/municipio es obligatorio/i)).toBeNull();
    });

    // Ahora selecciona el municipio de Jalisco y completa domicilio
    await fireEvent.press(screen.getByRole('button', { name: 'Municipio o Alcaldía' }));
    await fireEvent.press(await screen.findByText('Guadalajara'));
    expect(screen.getByText('Guadalajara')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Calle'), 'Av. Vallarta');
    await fireEvent.changeText(screen.getByLabelText('Número exterior'), '100');
    await fireEvent.changeText(screen.getByLabelText('Colonia'), 'Americana');
    await fireEvent.changeText(screen.getByLabelText('Código postal (5 dígitos)'), '44160');

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));

    // Paso 4: Ocupación solo letras + checklist en vivo + confirmar contraseña
    expect(await screen.findByText('Paso 4 de 4 · Empleo y seguridad')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Ocupación'), 'Ingeniero 2026');
    expect(screen.getByLabelText('Ocupación').props.value).toBe('Ingeniero ');

    expect(screen.getByText('Requisitos de seguridad')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'PasswordSegura#2026');
    await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'OtraClave#2026');
    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'PasswordSegura#2026');
    expect(screen.getByText('Las contraseñas coinciden')).toBeTruthy();
  });
});
