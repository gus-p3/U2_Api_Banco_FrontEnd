import { calculateCurp, calculateRfc } from './curpRfc';

describe('calculateCurp y calculateRfc (prefijos deterministas estándar bancario)', () => {
  it('calcula los primeros 16 caracteres de la CURP (faltan últimos 2) y los primeros 10 del RFC (faltan últimos 3)', () => {
    const input = {
      firstName: 'Alejandro',
      secondName: 'Carlos',
      lastName: 'Hernández',
      secondLastName: 'García',
      birthDate: '1995-05-15',
      genderName: 'Masculino',
      birthStateCode: '09',
    };
    const curpBase = calculateCurp(input);
    const rfcBase = calculateRfc(input);

    // HeRnández (R) · GaRcía (R) · ALejandro (L)
    expect(curpBase).toBe('HEGA950515HDFRRL');
    expect(curpBase).toHaveLength(16);

    expect(rfcBase).toBe('HEGA950515');
    expect(rfcBase).toHaveLength(10);
  });

  it('omite MARÍA/JOSÉ cuando hay segundo nombre compuesto', () => {
    const curpBase = calculateCurp({
      firstName: 'María',
      secondName: 'Fernanda',
      lastName: 'López',
      secondLastName: 'Pérez',
      birthDate: '2001-08-20',
      genderName: 'Femenino',
      birthStateCode: '14',
    });
    expect(curpBase).toBe('LOPF010820MJCPRR');
    expect(curpBase).toHaveLength(16);
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
    expect(calculateCurp(input)).toBe('RAXG980310HNEMXS');
    expect(calculateCurp(input)).toHaveLength(16);
    expect(calculateRfc(input)).toBe('RAGU980310');
  });

  it('sustituye palabras inconvenientes (antisonantes) en la segunda letra por X', () => {
    const curpBase = calculateCurp({
      firstName: 'Ana',
      lastName: 'Vaca',
      secondLastName: 'Cruz',
      birthDate: '1992-01-05',
      genderName: 'Mujer',
      birthStateCode: '19',
    });
    expect(curpBase).toBe('VXCA920105MNLCRN');
  });
});
