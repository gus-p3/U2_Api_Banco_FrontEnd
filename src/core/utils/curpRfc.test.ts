import { calculateCurp, calculateRfc } from './curpRfc';
import { CURP_REGEX, RFC_REGEX } from '@/features/auth/presentation/registerSchema';

describe('calculateCurp y calculateRfc', () => {
  it('calcula una CURP válida de 18 caracteres y RFC de 13 caracteres con 4 nombres', () => {
    const input = {
      firstName: 'Alejandro',
      secondName: 'Carlos',
      lastName: 'Hernández',
      secondLastName: 'García',
      birthDate: '1995-05-15',
      genderName: 'Masculino',
      birthStateCode: '09',
    };
    const curp = calculateCurp(input);
    const rfc = calculateRfc(input);

    expect(curp).not.toBeNull();
    expect(curp).toHaveLength(18);
    expect(CURP_REGEX.test(curp!)).toBe(true);
    // HeRnández (R) · GaRcía (R) · ALejandro (L)
    expect(curp!.startsWith('HEGA950515HDFRRL0')).toBe(true);

    expect(rfc).not.toBeNull();
    expect(rfc).toHaveLength(13);
    expect(RFC_REGEX.test(rfc!)).toBe(true);
    expect(rfc!.startsWith('HEGA950515')).toBe(true);
  });

  it('omite MARÍA/JOSÉ cuando hay segundo nombre compuesto', () => {
    const curp = calculateCurp({
      firstName: 'María',
      secondName: 'Fernanda',
      lastName: 'López',
      secondLastName: 'Pérez',
      birthDate: '2001-08-20',
      genderName: 'Femenino',
      birthStateCode: '14',
    });
    expect(curp).not.toBeNull();
    expect(CURP_REGEX.test(curp!)).toBe(true);
    // Usa F de Fernanda, siglo >= 2000 usa 'A', Jalisco = JC
    expect(curp!.startsWith('LOPF010820MJCRRA')).toBe(false);
    expect(curp!.slice(0, 16)).toBe('LOPF010820MJCPRR');
    expect(curp![16]).toBe('A');
  });

  it('soporta apellido materno opcional (usa X en CURP y regla SAT en RFC)', () => {
    const input = {
      firstName: 'Gustavo',
      secondName: '',
      lastName: 'Ramírez',
      secondLastName: '',
      birthDate: '1998-03-10',
      genderName: 'Hombre',
      birthStateCode: 'NE',
    };
    const curp = calculateCurp(input);
    const rfc = calculateRfc(input);

    expect(curp).not.toBeNull();
    expect(CURP_REGEX.test(curp!)).toBe(true);
    expect(curp!.slice(0, 13)).toBe('RAXG980310HNE');

    expect(rfc).not.toBeNull();
    expect(RFC_REGEX.test(rfc!)).toBe(true);
    expect(rfc!.startsWith('RAGU980310')).toBe(true);
  });

  it('sustituye palabras inconvenientes (antisonantes) en la segunda letra por X', () => {
    const curp = calculateCurp({
      firstName: 'Ana',
      lastName: 'Vaca',
      secondLastName: 'Cruz',
      birthDate: '1992-01-05',
      genderName: 'Mujer',
      birthStateCode: '19',
    });
    expect(curp).not.toBeNull();
    expect(curp!.startsWith('VXCA920105MNL')).toBe(true);
  });
});
