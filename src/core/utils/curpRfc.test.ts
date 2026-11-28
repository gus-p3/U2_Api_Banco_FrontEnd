import { calculateCurp, calculateRfc } from './curpRfc';

describe('calculateCurp y calculateRfc (prefijos deterministas)', () => {
  it('calcula los primeros 13 caracteres de la CURP y los primeros 10 del RFC', () => {
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

    expect(curpBase).toBe('HEGA950515HDF');
    expect(curpBase).toHaveLength(13);

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
    expect(curpBase).toBe('LOPF010820MJC');
    expect(curpBase).toHaveLength(13);
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
    expect(calculateCurp(input)).toBe('RAXG980310HNE');
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
    expect(curpBase).toBe('VXCA920105MNL');
  });
});
