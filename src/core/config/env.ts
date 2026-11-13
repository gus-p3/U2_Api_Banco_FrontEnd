import { Platform } from 'react-native';

/**
 * URL base del backend por entorno.
 * - Override explícito: EXPO_PUBLIC_API_URL (por defecto apunta a Railway en producción:
 *   https://bancodev-production.up.railway.app).
 * - Fallback por plataforma si EXPO_PUBLIC_API_URL está vacío:
 *   Cloud Railway (https://bancodev-production.up.railway.app).
 *   Para entorno local usar EXPO_PUBLIC_API_URL=http://localhost:8080 (Web / ADB reverse)
 *   o http://10.0.2.2:8080 (emulador Android).
 */
const DEFAULT_CLOUD_URL = 'https://bancodev-production.up.railway.app';
const DEFAULT_WEB_URL = DEFAULT_CLOUD_URL;
const DEFAULT_ANDROID_URL = DEFAULT_CLOUD_URL;

function resolveApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  return Platform.OS === 'android' ? DEFAULT_ANDROID_URL : DEFAULT_WEB_URL;
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  requestTimeoutMs: 20_000,
  /** Segundos restantes del access token a partir de los cuales se muestra el aviso de expiración. */
  sessionWarningSeconds: 60,
} as const;
