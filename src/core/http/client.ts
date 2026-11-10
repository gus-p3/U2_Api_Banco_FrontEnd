import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/AppError';
import { SESSION_ENDED_CODES, TOKEN_REFRESHABLE_CODES, toAppError } from '@/core/errors/toAppError';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** No adjunta Bearer ni intenta refresh (login, refresh, catálogos públicos). */
    skipAuth?: boolean;
    /** Marca interna: la petición ya se reintentó tras renovar el token. */
    _retried?: boolean;
  }
}

export type SessionEndReason = 'inactivity' | 'refresh-failed' | 'unauthorized';

/** Puente entre el cliente HTTP y el estado de sesión (evita dependencias circulares). */
export interface AuthBridge {
  getAccessToken(): string | null;
  /** Renueva tokens y devuelve el nuevo access token. Debe lanzar si falla. */
  refreshTokens(): Promise<string>;
  onSessionEnded(reason: SessionEndReason): void;
}

const noopBridge: AuthBridge = {
  getAccessToken: () => null,
  refreshTokens: () => Promise.reject(new Error('AuthBridge no configurado')),
  onSessionEnded: () => undefined,
};

let currentBridge: AuthBridge = noopBridge;

/** Registra el puente de autenticación (se llama una vez en el bootstrap de la app). */
export function configureAuthBridge(bridge: AuthBridge): void {
  currentBridge = bridge;
}

/** Evita múltiples refresh simultáneos: todas las peticiones 401 comparten una sola promesa. */
let refreshInFlight: Promise<string> | null = null;

function refreshOnce(bridge: AuthBridge): Promise<string> {
  refreshInFlight ??= bridge.refreshTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function createHttpClient(
  config: AxiosRequestConfig = {},
  getBridge: () => AuthBridge = () => currentBridge,
): AxiosInstance {
  const instance = axios.create({
    baseURL: env.apiBaseUrl,
    timeout: env.requestTimeoutMs,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...config,
  });

  instance.interceptors.request.use((request: InternalAxiosRequestConfig) => {
    if (!request.skipAuth) {
      const token = getBridge().getAccessToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
      const appError = toAppError(error);
      const bridge = getBridge();

      if (appError.status === 401 && original && !original.skipAuth) {
        if (SESSION_ENDED_CODES.includes(appError.code)) {
          bridge.onSessionEnded('inactivity');
          throw appError;
        }

        if (TOKEN_REFRESHABLE_CODES.includes(appError.code) && !original._retried) {
          original._retried = true;
          try {
            const newToken = await refreshOnce(bridge);
            original.headers.set('Authorization', `Bearer ${newToken}`);
          } catch {
            bridge.onSessionEnded('refresh-failed');
            throw new AppError({
              code: 'TOKEN_EXPIRED_OR_INVALID',
              message: appError.message,
              status: 401,
            });
          }
          try {
            return await instance.request(original);
          } catch (retryError) {
            const retryAppError = toAppError(retryError);
            if (retryAppError.status === 401) bridge.onSessionEnded('unauthorized');
            throw retryAppError;
          }
        }

        bridge.onSessionEnded('unauthorized');
      }

      throw appError;
    },
  );

  return instance;
}

/** Cliente HTTP compartido por todas las features. */
export const http = createHttpClient();
