import {
  validateAdultBirthDate,
  validateDateRange,
  validatePaymentAmount,
  validatePhone10,
  validateSearchQuery,
  validateServiceReference,
} from '@/core/validation/validators';
import { loginSchema } from '@/features/auth/presentation/loginSchema';
import { registerSchema, type RegisterFormValues } from '@/features/auth/presentation/registerSchema';

const VALID_REGISTER: RegisterFormValues = {
  name: 'Alejandro',
  lastName: 'Hernández',
  birthDate: '1995-05-15',
  curp: 'HERA950515HDFRND01',
  rfc: 'HERA950515ABC',
  idGender: 1,
  idNationality: 1,
  idMaritalStatus: 1,
  email: 'alejandro.hernandez@banco-demo.com',
  mobilePhone: '5512345678',
  street: 'Av. Paseo de la Reforma',
  exteriorNumber: '222',
  neighborhood: 'Juárez',
  claveEntidad: '09',
  idMunicipality: 15,
  postalCode: '06600',
  occupation: 'Ingeniero de Software',
  company: 'Banco Digital SA',
  monthlyIncome: '25000.00',
  password: 'PasswordSegura#2026',
  confirmPassword: 'PasswordSegura#2026',
};

function fieldError<T extends Record<string, unknown>>(
  schema: {
    safeParse: (v: T) => {
      success: boolean;
      error?: { issues: Array<{ path: PropertyKey[]; message: string }> };
    };
  },
  data: T,
  field: keyof T,
): string | undefined {
  const res = schema.safeParse(data);
  if (res.success) return undefined;
  return res.error?.issues.find((i) => i.path[0] === field)?.message;
}

describe('Validaciones de Login (paridad 1:1 con AuthRequest.java)', () => {
  const validLogin = {
    email: 'alejandro.hernandez@banco-demo.com',
    password: 'PasswordSegura#2026',
  };

  it('acepta credenciales válidas', () => {
    expect(loginSchema.safeParse(validLogin).success).toBe(true);
  });

  it('valida campo email: obligatorio, máximo 100 caracteres y formato regex', () => {
    expect(fieldError(loginSchema, { ...validLogin, email: '' }, 'email')).toBe(
      'El correo electrónico es obligatorio',
    );
    expect(fieldError(loginSchema, { ...validLogin, email: '   ' }, 'email')).toBe(
      'El correo electrónico es obligatorio',
    );
    expect(fieldError(loginSchema, { ...validLogin, email: 'sin-arroba.com' }, 'email')).toBe(
      'El formato del correo electrónico es inválido',
    );
    expect(fieldError(loginSchema, { ...validLogin, email: 'user@dominio.c' }, 'email')).toBe(
      'El formato del correo electrónico es inválido',
    );
    expect(
      fieldError(loginSchema, { ...validLogin, email: `${'a'.repeat(92)}@test.com` }, 'email'),
    ).toBe('El email no puede superar los 100 caracteres');
  });

  it('valida campo password: obligatorio, 12-100 caracteres y complejidad', () => {
    expect(fieldError(loginSchema, { ...validLogin, password: '' }, 'password')).toBe(
      'La contraseña es obligatoria',
    );
    expect(fieldError(loginSchema, { ...validLogin, password: 'Ab1#corta' }, 'password')).toBe(
      'La contraseña debe tener entre 12 y 100 caracteres',
    );
    expect(
      fieldError(loginSchema, { ...validLogin, password: `Aa1#${'x'.repeat(97)}` }, 'password'),
    ).toBe('La contraseña debe tener entre 12 y 100 caracteres');
    expect(fieldError(loginSchema, { ...validLogin, password: 'passwordsegura#2026' }, 'password')).toBe(
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    );
    expect(fieldError(loginSchema, { ...validLogin, password: 'PASSWORDSEGURA#2026' }, 'password')).toBe(
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    );
    expect(fieldError(loginSchema, { ...validLogin, password: 'PasswordSegura#ABCD' }, 'password')).toBe(
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    );
    expect(fieldError(loginSchema, { ...validLogin, password: 'PasswordSegura2026' }, 'password')).toBe(
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    );
  });
});

describe('Validaciones de Registro / Onboarding (paridad 1:1 con ClientOnboardingRequest.java)', () => {
  it('acepta formulario completo válido', () => {
    expect(registerSchema.safeParse(VALID_REGISTER).success).toBe(true);
  });

  it('valida name y lastName: obligatorio, 2-50 chars y solo letras/acentos/espacios', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, name: '' }, 'name')).toBe(
      'El nombre es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, name: 'A' }, 'name')).toBe(
      'El nombre debe tener entre 2 y 50 caracteres',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, name: 'A'.repeat(51) }, 'name')).toBe(
      'El nombre debe tener entre 2 y 50 caracteres',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, name: 'Alejandro123' }, 'name')).toBe(
      'El nombre contiene caracteres no válidos',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, name: 'José Ángel' }, 'name'),
    ).toBeUndefined();

    expect(fieldError(registerSchema, { ...VALID_REGISTER, lastName: '' }, 'lastName')).toBe(
      'El apellido paterno es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, lastName: 'H' }, 'lastName')).toBe(
      'El apellido paterno debe tener entre 2 y 50 caracteres',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, lastName: 'H'.repeat(51) }, 'lastName')).toBe(
      'El apellido paterno debe tener entre 2 y 50 caracteres',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, lastName: 'Hernández$' }, 'lastName')).toBe(
      'El apellido paterno contiene caracteres no válidos',
    );
  });

  it('valida birthDate: obligatoria, YYYY-MM-DD real, en pasado y mayor de 18 años', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, birthDate: '' }, 'birthDate')).toBe(
      'La fecha de nacimiento es obligatoria',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, birthDate: '15/05/1995' }, 'birthDate')).toBe(
      'La fecha de nacimiento debe tener formato válido (YYYY-MM-DD)',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, birthDate: '1995-02-30' }, 'birthDate')).toBe(
      'La fecha de nacimiento debe tener formato válido (YYYY-MM-DD)',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, birthDate: '2099-01-01' }, 'birthDate')).toBe(
      'La fecha de nacimiento debe ser en el pasado',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, birthDate: '2015-05-15' }, 'birthDate'),
    ).toContain('al menos 18 años');
    expect(validateAdultBirthDate('1901-01-01')).toContain('Verifica el año');
    expect(validateAdultBirthDate('1890-01-01')).toBeTruthy();
  });

  it('valida curp: obligatoria, exactamente 18 chars y regex oficial RENAPO', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, curp: '' }, 'curp')).toBe(
      'La CURP es obligatoria',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, curp: 'HERA950515' }, 'curp')).toBe(
      'La CURP debe tener exactamente 18 caracteres',
    );
    // Sexo inválido 'X' en posición 11
    expect(fieldError(registerSchema, { ...VALID_REGISTER, curp: 'HERA950515XDFRND01' }, 'curp')).toBe(
      'El formato de la CURP es inválido',
    );
    // Normaliza minúsculas automáticamente
    expect(registerSchema.safeParse({ ...VALID_REGISTER, curp: 'hera950515hdfrnd01' }).success).toBe(
      true,
    );
  });

  it('valida rfc: obligatorio, 12-13 chars y regex SAT (física y moral)', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, rfc: '' }, 'rfc')).toBe(
      'El RFC es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, rfc: 'HERA950515' }, 'rfc')).toBe(
      'El RFC debe tener 12 o 13 caracteres',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, rfc: '1234950515ABC' }, 'rfc')).toBe(
      'El formato del RFC es inválido',
    );
    expect(registerSchema.safeParse({ ...VALID_REGISTER, rfc: 'BAN950515ABC' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...VALID_REGISTER, rfc: 'Ñ&A9505151A2' }).success).toBe(true);
  });

  it('valida catálogos numéricos positivos: idGender, idNationality, idMaritalStatus, idMunicipality', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, idGender: 0 }, 'idGender')).toBe(
      'El identificador del género debe ser positivo',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, idNationality: -1 }, 'idNationality')).toBe(
      'El identificador de la nacionalidad debe ser positivo',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, idMaritalStatus: 0 }, 'idMaritalStatus'),
    ).toBe('El identificador del estado civil debe ser positivo');
    expect(fieldError(registerSchema, { ...VALID_REGISTER, idMunicipality: 0 }, 'idMunicipality')).toBe(
      'El identificador del municipio debe ser positivo',
    );
  });

  it('valida contacto: email y mobilePhone (10 dígitos)', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, email: '' }, 'email')).toBe(
      'El correo electrónico es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, email: 'mal@correo' }, 'email')).toBe(
      'El formato del correo electrónico es inválido',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, mobilePhone: '' }, 'mobilePhone')).toBe(
      'El teléfono móvil es obligatorio',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, mobilePhone: '5512345' }, 'mobilePhone'),
    ).toBe('El teléfono móvil debe contener exactamente 10 dígitos numéricos');
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, mobilePhone: '55-1234-56' }, 'mobilePhone'),
    ).toBe('El teléfono móvil debe contener exactamente 10 dígitos numéricos');
  });

  it('valida domicilio: street, exteriorNumber, neighborhood, claveEntidad y postalCode', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, street: '' }, 'street')).toBe(
      'La calle es obligatoria',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, street: 'C'.repeat(101) }, 'street')).toBe(
      'La calle no puede superar los 100 caracteres',
    );

    expect(fieldError(registerSchema, { ...VALID_REGISTER, exteriorNumber: '' }, 'exteriorNumber')).toBe(
      'El número exterior es obligatorio',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, exteriorNumber: '12345678901' }, 'exteriorNumber'),
    ).toBe('El número exterior no puede superar los 10 caracteres');

    expect(fieldError(registerSchema, { ...VALID_REGISTER, neighborhood: '' }, 'neighborhood')).toBe(
      'La colonia es obligatoria',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, neighborhood: 'N'.repeat(81) }, 'neighborhood'),
    ).toBe('La colonia no puede superar los 80 caracteres');

    expect(fieldError(registerSchema, { ...VALID_REGISTER, claveEntidad: '9' }, 'claveEntidad')).toBe(
      "La clave de entidad debe tener 2 dígitos numéricos (ej. '09')",
    );

    expect(fieldError(registerSchema, { ...VALID_REGISTER, postalCode: '' }, 'postalCode')).toBe(
      'El código postal es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, postalCode: '0660' }, 'postalCode')).toBe(
      'El código postal debe contener exactamente 5 dígitos numéricos',
    );
  });

  it('valida empleo e ingreso mensual: occupation, company, monthlyIncome y password', () => {
    expect(fieldError(registerSchema, { ...VALID_REGISTER, occupation: '' }, 'occupation')).toBe(
      'La ocupación es obligatoria',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, occupation: 'O'.repeat(81) }, 'occupation'),
    ).toBe('La ocupación no puede superar los 80 caracteres');

    expect(fieldError(registerSchema, { ...VALID_REGISTER, company: '' }, 'company')).toBe(
      'La empresa es obligatoria',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, company: 'E'.repeat(101) }, 'company')).toBe(
      'La empresa no puede superar los 100 caracteres',
    );

    expect(fieldError(registerSchema, { ...VALID_REGISTER, monthlyIncome: '' }, 'monthlyIncome')).toBe(
      'El ingreso mensual es obligatorio',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, monthlyIncome: '0' }, 'monthlyIncome')).toBe(
      'El ingreso mensual debe ser mayor a cero',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, monthlyIncome: '25000.123' }, 'monthlyIncome'),
    ).toBe('El ingreso mensual admite máximo 10 enteros y 2 decimales');
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, monthlyIncome: '12345678901' }, 'monthlyIncome'),
    ).toBe('El ingreso mensual admite máximo 10 enteros y 2 decimales');

    expect(fieldError(registerSchema, { ...VALID_REGISTER, password: '' }, 'password')).toBe(
      'La contraseña de acceso es obligatoria',
    );
    expect(fieldError(registerSchema, { ...VALID_REGISTER, password: 'Corta#1' }, 'password')).toBe(
      'La contraseña debe tener entre 12 y 100 caracteres',
    );
    expect(
      fieldError(registerSchema, { ...VALID_REGISTER, password: 'SinEspeciales123' }, 'password'),
    ).toBe(
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    );
  });
});

describe('Validaciones de Pagos, Recargas, Búsquedas y Filtros (paridad con PagoRequest / ValidarReferenciaRequest)', () => {
  it('valida teléfono de recarga (10 dígitos, no vacío, no letras, no solo ceros)', () => {
    expect(validatePhone10('')).toBe('El número telefónico es obligatorio.');
    expect(validatePhone10('5512345')).toContain('10 dígitos');
    expect(validatePhone10('551234567a')).toContain('10 dígitos');
    expect(validatePhone10('0000000000')).toContain('únicamente de ceros');
    expect(validatePhone10('5512345678')).toBeUndefined();
  });

  it('valida referencia de servicio (longitud, caracteres, solo dígitos, 10 dígitos y dígito verificador)', () => {
    expect(validateServiceReference('')).toBe('La referencia del servicio es obligatoria.');
    expect(validateServiceReference('123')).toContain('entre 4 y 60');
    expect(validateServiceReference('A'.repeat(61))).toContain('entre 4 y 60');
    expect(validateServiceReference('1234 5678')).toContain('sin espacios');
    expect(validateServiceReference('000000')).toContain('únicamente de ceros');
    expect(validateServiceReference('ABC12345', { hasCheckDigit: true })).toContain(
      'únicamente por dígitos',
    );
    expect(validateServiceReference('123456789', { referenceType: '10 dígitos numéricos' })).toContain(
      'exactamente 10 dígitos',
    );
    expect(validateServiceReference('12345', { hasCheckDigit: true })).toContain('al menos 6 dígitos');
    expect(validateServiceReference('77777777', { hasCheckDigit: true })).toContain(
      'dígito verificador',
    );
    expect(
      validateServiceReference('979011005160', { hasCheckDigit: true, referenceType: '12 dígitos' }),
    ).toBeUndefined();
  });

  it('valida monto de pago (obligatorio, 2 decimales, >0, límite, precio fijo y saldo)', () => {
    expect(validatePaymentAmount('')).toBe('El monto a pagar es obligatorio.');
    expect(validatePaymentAmount('abc')).toContain('máximo 2 decimales');
    expect(validatePaymentAmount('150.123')).toContain('máximo 2 decimales');
    expect(validatePaymentAmount('0')).toContain('mayor a $0.00');
    expect(validatePaymentAmount('600000')).toContain('límite permitido');
    expect(validatePaymentAmount('120', { fixedPrice: 150 })).toContain('$150.00');
    expect(validatePaymentAmount('500', { maxBalance: 200 })).toContain('saldo disponible');
    expect(validatePaymentAmount('150.50', { maxBalance: 500 })).toBeUndefined();
  });

  it('valida búsquedas y rango de fechas de historial', () => {
    expect(validateSearchQuery('')).toBeUndefined();
    expect(validateSearchQuery('a'.repeat(61))).toContain('60 caracteres');
    expect(validateSearchQuery('<script>')).toContain('caracteres especiales');
    expect(validateSearchQuery('CFE - Luz 100')).toBeUndefined();

    expect(validateDateRange('2026/01/01', '').desdeError).toContain('AAAA-MM-DD');
    expect(validateDateRange('2026-02-29', '').desdeError).toContain('fecha real');
    expect(validateDateRange('2026-05-10', '2026-05-01').hastaError).toContain('anterior');
    expect(validateDateRange('2026-05-01', '2026-05-10').validRange).toBe(true);
  });
});
