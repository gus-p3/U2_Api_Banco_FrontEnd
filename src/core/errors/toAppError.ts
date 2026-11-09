import axios from 'axios';

import { AppError, type ApiErrorBody, type ApiErrorCode, isAppError } from './AppError';
import { isKnownErrorCode, messageForCode } from './errorMessages';

/** Cuerpo 401 del ServerSessionInterceptor (distinto del ErrorResponse estándar). */
interface SessionInterceptorBody {
  status?: number;
  error?: string;
  message?: string;
  inactivityLimitSeconds?: number;
}

const isSessionInterceptorBody = (data: unknown): data is SessionInterceptorBody =>
  typeof data === 'object' &&
  data !== null &&
  'inactivityLimitSeconds' in data &&
  !('error' in data && typeof (data as { error: unknown }).error === 'object');

const statusFallback = (status: number | undefined): ApiErrorCode => {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'TOKEN_EXPIRED_OR_INVALID';
    case 403:
      return 'FORBIDDEN';
    case 423:
      return 'ACCOUNT_LOCKED';
    case 405:
      return 'METHOD_NOT_ALLOWED';
    default:
      return status !== undefined && status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN';
  }
};

/** Convierte cualquier error (Axios, backend o desconocido) en un `AppError` con mensaje en español. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new AppError({ code: 'TIMEOUT', message: messageForCode('TIMEOUT') });
    }
    const response = error.response;
    if (!response) {
      return new AppError({ code: 'NETWORK_ERROR', message: messageForCode('NETWORK_ERROR') });
    }

    const data: unknown = response.data;
    if (isSessionInterceptorBody(data)) {
      return new AppError({
        code: 'SESSION_INACTIVE',
        message: messageForCode('SESSION_INACTIVE'),
        status: response.status,
        serverMessage: data.message,
      });
    }

    const body = data as ApiErrorBody | undefined;
    const detail = body?.error;
    const rawCode = detail?.code;
    const code: ApiErrorCode = isKnownErrorCode(rawCode) ? rawCode : statusFallback(response.status);

    // Para validaciones (400) mostramos el primer detalle legible del backend.
    const firstDetail = detail?.details?.find((d) => d.message)?.message;
    const message =
      (code === 'BAD_REQUEST' || code === 'INVALID_PARAM') && firstDetail
        ? firstDetail
        : messageForCode(code);

    return new AppError({
      code,
      message,
      status: response.status,
      target: detail?.target,
      details: detail?.details,
      serverMessage: detail?.message,
    });
  }

  return new AppError({
    code: 'UNKNOWN',
    message: messageForCode('UNKNOWN'),
    serverMessage: error instanceof Error ? error.message : undefined,
  });
}

/** Códigos que indican que la sesión de servidor terminó (no se debe reintentar con refresh). */
export const SESSION_ENDED_CODES: readonly ApiErrorCode[] = ['SESSION_INACTIVE'];
/** Códigos 401 que sí pueden resolverse renovando el access token. */
export const TOKEN_REFRESHABLE_CODES: readonly ApiErrorCode[] = [
  'TOKEN_EXPIRED_OR_INVALID',
  'TOKEN_MISSING',
];
