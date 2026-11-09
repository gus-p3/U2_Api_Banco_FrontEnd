import type { ApiErrorCode } from './AppError';

/** Mensajes amigables en español para cada código de error. */
export const errorMessages: Record<ApiErrorCode, string> = {
  CLIENT_NOT_FOUND: 'No encontramos tu información de cliente.',
  ACCOUNT_NOT_FOUND: 'No encontramos la cuenta solicitada.',
  CATALOG_NOT_FOUND: 'No encontramos el dato solicitado en el catálogo.',
  CURP_DUPLICATED: 'La CURP ya está registrada.',
  RFC_DUPLICATED: 'El RFC ya está registrado.',
  EMAIL_DUPLICATED: 'El correo electrónico ya está en uso.',
  PHONE_DUPLICATED: 'El teléfono ya está registrado.',
  CLIENT_INACTIVE: 'Tu cliente se encuentra inactivo. Contacta a tu sucursal.',
  INVALID_AGE: 'Debes ser mayor de edad para registrarte.',
  STATE_MISMATCH: 'El estado no coincide con el municipio seleccionado.',
  BUSINESS_VALIDATION: 'No pudimos completar la operación por una regla del banco.',
  INSUFFICIENT_FUNDS: 'Saldo insuficiente para realizar el pago.',
  PAYMENT_ACCOUNT_INACTIVE: 'La cuenta no está activa para realizar pagos.',
  PAYMENT_PRODUCT_MISMATCH: 'El producto elegido no corresponde al tipo de pago.',
  INVALID_PAYMENT_REQUEST: 'Revisa los datos del pago e inténtalo de nuevo.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  BIOMETRIC_AUTH_FAILED: 'No pudimos validar tu huella. Inicia sesión con tu contraseña.',
  TOKEN_EXPIRED_OR_INVALID: 'Tu sesión expiró. Inicia sesión nuevamente.',
  ACCOUNT_LOCKED: 'Tu cuenta está bloqueada por intentos fallidos. Contacta a tu sucursal.',
  ACCESS_DENIED: 'No tienes acceso a este recurso.',
  TOKEN_MISSING: 'Debes iniciar sesión para continuar.',
  SESSION_INACTIVE: 'Tu sesión terminó por inactividad. Inicia sesión nuevamente.',
  STRONG_AUTH_REQUIRED: 'Para pagar necesitas confirmar con tu huella digital.',
  PAYMENT_FORBIDDEN: 'No es posible operar con la cuenta indicada.',
  BAD_REQUEST: 'La solicitud no es válida. Revisa los datos capturados.',
  INVALID_PARAM: 'Alguno de los datos enviados no es válido.',
  METHOD_NOT_ALLOWED: 'Operación no permitida.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  INTERNAL_ERROR: 'Ocurrió un error en el servidor. Intenta más tarde.',
  SERVER_ERROR: 'Ocurrió un error en el servidor. Intenta más tarde.',
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  UNKNOWN: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  BIOMETRIC_UNAVAILABLE: 'Este dispositivo no tiene biometría disponible.',
  BIOMETRIC_CANCELLED: 'Cancelaste la verificación biométrica.',
  BIOMETRIC_NOT_ENROLLED: 'Aún no activas la huella en este dispositivo. Actívala en Perfil.',
  UNSUPPORTED_PLATFORM: 'Esta función solo está disponible en la app Android.',
};

const knownCodes = new Set<string>(Object.keys(errorMessages));

export const isKnownErrorCode = (code: string | undefined): code is ApiErrorCode =>
  code !== undefined && knownCodes.has(code);

/** Mensaje en español para un código; cae a UNKNOWN si no se conoce. */
export function messageForCode(code: string | undefined): string {
  return isKnownErrorCode(code) ? errorMessages[code] : errorMessages.UNKNOWN;
}
