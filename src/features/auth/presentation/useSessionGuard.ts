import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { env } from '@/core/config/env';

import { endSessionLocally, refreshSession, signOut } from './authActions';
import { selectIsAuthenticated, useSessionStore } from './sessionStore';

/**
 * La sesión es stateless: dura lo que el access token (claim `exp` del JWT). No hay consulta al servidor.
 * - Calcula los segundos restantes localmente cada segundo.
 * - Muestra aviso cuando quedan <= sessionWarningSeconds.
 * - `keepAlive` renueva los tokens con el refresh token (POST /v1/auth/refresh).
 * - Si el token vence sin renovarse, cierra la sesión de forma limpia.
 */
export function useSessionGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const expiresAt = useSessionStore((s) => s.session?.expiresAt);
  const remaining = useSessionStore((s) => s.remainingSeconds);
  const setRemaining = useSessionStore((s) => s.setRemainingSeconds);
  const [keepingAlive, setKeepingAlive] = useState(false);

  const tick = useCallback(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const seconds = Math.ceil((expiresAt - Date.now()) / 1000);
    if (seconds <= 0) {
      void endSessionLocally('inactivity');
      return;
    }
    setRemaining(seconds);
  }, [expiresAt, setRemaining]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    tick();
    const timer = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isAuthenticated, tick]);

  const showWarning = isAuthenticated && remaining !== null && remaining <= env.sessionWarningSeconds;

  const keepAlive = useCallback(async () => {
    setKeepingAlive(true);
    try {
      await refreshSession();
    } catch {
      await endSessionLocally('refresh-failed');
    } finally {
      setKeepingAlive(false);
    }
  }, []);

  return { remaining, showWarning, keepAlive, keepingAlive, signOut };
}
