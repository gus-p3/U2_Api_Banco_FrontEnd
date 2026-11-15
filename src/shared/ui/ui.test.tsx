import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, Input, ProviderLogo } from '@/shared/ui';

describe('Componentes UI compartidos', () => {
  it('Button ejecuta onPress y se deshabilita durante loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button title="Confirmar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Button title="Confirmar" loading onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Input muestra etiqueta, actualiza texto y despliega mensaje de error accesible', async () => {
    const onChangeText = jest.fn();
    await render(
      <Input
        label="Correo electrónico"
        value=""
        onChangeText={onChangeText}
        error="El correo es obligatorio"
      />,
    );
    expect(screen.getByText('Correo electrónico')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('El correo es obligatorio');
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'test@banco.com');
    expect(onChangeText).toHaveBeenCalledWith('test@banco.com');
  });

  it('ProviderLogo muestra avatar neutro con iniciales cuando no hay logoUrl', async () => {
    await render(<ProviderLogo name="Telcel" />);
    expect(screen.getByText('TE')).toBeTruthy();

    await render(<ProviderLogo name="Comisión Federal" />);
    expect(screen.getByText('CF')).toBeTruthy();
  });
});
