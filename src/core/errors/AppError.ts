/** Códigos de error del backend (`ErrorCode`) y genéricos del GlobalExceptionHandler. */
export type ApiErrorCode =
  | 'CLIENT_NOT_FOUND'
  | 'ACCOUNT_NOT_FOUND'
  | 'CATALOG_NOT_FOUND'
  | 'CURP_DUPLICATED'
  | 'RFC_DUPLICATED'
  | 'EMAIL_DUPLICATED'
  | 'PHONE_DUPLICATED'
  | 'CLIENT_INACTIVE'
  | 'INVALID_AGE'
  | 'STATE_MISMATCH'
  | 'BUSINESS_VALIDATION'
  | 'INSUFFICIENT_FUNDS'
  | 'PAYMENT_ACCOUNT_INACTIVE'
  | 'PAYMENT_PRODUCT_MISMATCH'
  | 'INVALID_PAYMENT_REQUEST'
  | 'INVALID_CREDENTIALS'
  | 'BIOMETRIC_AUTH_FAILED'
  | 'TOKEN_EXPIRED_OR_INVALID'
  | 'ACCOUNT_LOCKED'
  | 'ACCESS_DENIED'
  | 'TOKEN_MISSING'
  | 'SESSION_INACTIVE'
  | 'STRONG_AUTH_REQUIRED'
  | 'PAYMENT_FORBIDDEN'
  | 'BAD_REQUEST'
  | 'INVALID_PARAM'
  | 'METHOD_NOT_ALLOWED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'SERVER_ERROR'
  // Códigos locales del frontend
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'
  | 'BIOMETRIC_UNAVAILABLE'
  | 'BIOMETRIC_CANCELLED'
  | 'BIOMETRIC_NOT_ENROLLED'
  | 'UNSUPPORTED_PLATFORM';

export interface ApiErrorDetail {
  code?: string;
  target?: string;
  message?: string;
}

/** Cuerpo estándar de error del backend. */
export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    target?: string;
    details?: ApiErrorDetail[];
  };
}

/** Error normalizado que consume la UI. */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly target?: string;
  readonly details: ApiErrorDetail[];
  /** Mensaje original del backend (útil para logs, no para mostrar). */
  readonly serverMessage?: string;

  constructor(params: {
    code: ApiErrorCode;
    message: string;
    status?: number;
    target?: string;
    details?: ApiErrorDetail[];
    serverMessage?: string;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.status = params.status;
    this.target = params.target;
    this.details = params.details ?? [];
    this.serverMessage = params.serverMessage;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
