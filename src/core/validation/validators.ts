/**
 * Validadores centralizados para todos los campos de captura, filtros y pagos de la aplicación.
 * Cada función devuelve `undefined` cuando el valor es válido o un mensaje claro en español cuando falla.
 */

const SAFE_SEARCH_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&\-_/#()]*$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_AMOUNT_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

export function parseValidCalendarDate(value: string): Date | null {
  const match = ISO_DATE_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function validateSearchQuery(value: string, maxLen = 60): string | undefined {
  if (!value) return undefined;
  if (value.length > maxLen) {
    return `La búsqueda no puede exceder ${maxLen} caracteres.`;
  }
  if (!SAFE_SEARCH_REGEX.test(value)) {
    return 'La búsqueda contiene caracteres especiales no permitidos.';
  }
  return undefined;
}

export function validateOptionalIsoDate(value: string, fieldLabel = 'La fecha'): string | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  if (!ISO_DATE_REGEX.test(clean)) {
    return `${fieldLabel} debe tener formato AAAA-MM-DD (ej. 2026-05-15).`;
  }
  if (!parseValidCalendarDate(clean)) {
    return `${fieldLabel} no corresponde a una fecha real del calendario.`;
  }
  return undefined;
}

export function validateDateRange(
  desde: string,
  hasta: string,
): { desdeError?: string; hastaError?: string; validRange: boolean } {
  const desdeError = validateOptionalIsoDate(desde, 'La fecha inicial');
  let hastaError = validateOptionalIsoDate(hasta, 'La fecha final');

  if (!desdeError && !hastaError && desde.trim() && hasta.trim()) {
    const d1 = parseValidCalendarDate(desde.trim());
    const d2 = parseValidCalendarDate(hasta.trim());
    if (d1 && d2 && d1.getTime() > d2.getTime()) {
      hastaError = 'La fecha final no puede ser anterior a la fecha inicial.';
    }
  }

  return {
    desdeError,
    hastaError,
    validRange: !desdeError && !hastaError,
  };
}

export function validateAdultBirthDate(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return 'La fecha de nacimiento es obligatoria.';
  if (!ISO_DATE_REGEX.test(clean)) {
    return 'Usa el formato AAAA-MM-DD (ej. 1995-05-15).';
  }
  const birth = parseValidCalendarDate(clean);
  if (!birth) {
    return 'Ingresa una fecha de nacimiento válida en el calendario.';
  }
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (birth.getTime() >= todayUtc.getTime()) {
    return 'La fecha de nacimiento debe ser en el pasado.';
  }
  let age = todayUtc.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = todayUtc.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && todayUtc.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  if (age < 18) {
    return 'Debes tener al menos 18 años cumplidos para abrir una cuenta.';
  }
  if (age > 120) {
    return 'Verifica el año de nacimiento ingresado.';
  }
  return undefined;
}

export function validatePhone10(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) {
    return 'El número telefónico es obligatorio.';
  }
  if (!/^[0-9]{10}$/.test(clean)) {
    return 'Ingresa exactamente 10 dígitos numéricos sin espacios ni guiones.';
  }
  if (/^0+$/.test(clean)) {
    return 'El número telefónico no puede consistir únicamente de ceros.';
  }
  return undefined;
}

export interface ReferenceProductRules {
  hasCheckDigit?: boolean;
  referenceType?: string;
}

export function validateServiceReference(
  value: string,
  product?: ReferenceProductRules | null,
): string | undefined {
  const clean = value.trim();
  if (!clean) {
    return 'La referencia del servicio es obligatoria.';
  }
  if (clean.length < 4 || clean.length > 60) {
    return 'La referencia debe tener entre 4 y 60 caracteres.';
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(clean)) {
    return 'Solo se permiten letras, números, guiones (-) o guion bajo (_), sin espacios.';
  }
  if (/^0+$/.test(clean)) {
    return 'La referencia no puede consistir únicamente de ceros.';
  }

  const tipoRef = (product?.referenceType ?? '').toLowerCase();
  const requiresDigitsOnly =
    Boolean(product?.hasCheckDigit) ||
    tipoRef.includes('dígito') ||
    tipoRef.includes('digito') ||
    tipoRef.includes('numéric') ||
    tipoRef.includes('numeric') ||
    tipoRef.includes('celular');

  if (requiresDigitsOnly && !/^\d+$/.test(clean)) {
    return 'Este servicio exige una referencia compuesta únicamente por dígitos numéricos.';
  }

  if ((tipoRef.includes('10 dígitos') || tipoRef.includes('10 digitos')) && clean.length !== 10) {
    return 'La referencia para este servicio debe tener exactamente 10 dígitos.';
  }

  if (product?.hasCheckDigit) {
    if (clean.length < 6) {
      return 'La referencia con dígito verificador requiere al menos 6 dígitos.';
    }
    if (new Set(clean.split('')).size === 1 || clean.endsWith('99999')) {
      return 'El dígito verificador de la referencia no es válido.';
    }
  }

  return undefined;
}

export function validatePaymentAmount(
  value: string,
  options?: { maxBalance?: number; fixedPrice?: number; maxLimit?: number },
): string | undefined {
  const clean = value.trim();
  if (!clean) {
    return 'El monto a pagar es obligatorio.';
  }
  if (!DECIMAL_AMOUNT_REGEX.test(clean)) {
    return 'Ingresa un monto numérico válido con máximo 2 decimales (ej. 150.00).';
  }
  const num = Number(clean);
  if (!Number.isFinite(num) || num <= 0) {
    return 'El monto debe ser mayor a $0.00.';
  }
  const maxLimit = options?.maxLimit ?? 500_000;
  if (num > maxLimit) {
    return `El monto excede el límite permitido por operación ($${maxLimit.toLocaleString('es-MX')}).`;
  }
  if (options?.fixedPrice && options.fixedPrice > 0 && Math.abs(num - options.fixedPrice) > 0.001) {
    return `Este servicio requiere el importe exacto de $${options.fixedPrice.toFixed(2)}.`;
  }
  if (typeof options?.maxBalance === 'number' && num > options.maxBalance) {
    return 'El monto supera el saldo disponible en tu cuenta seleccionada.';
  }
  return undefined;
}
