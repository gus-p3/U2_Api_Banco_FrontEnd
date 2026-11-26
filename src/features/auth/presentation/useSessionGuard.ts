import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { env } from '@/core/config/env';

import { endSessionLocally, refreshSession, signOut } from './authActions';
import { selectIsAuthenticated, useSessionStore } from './sessionStore';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inactividad real
const SILENT_REFRESH_THRESHOLD_MS = 65 * 1000; // renueva JWT en silencio si faltan <= 65s y hay actividad

let lastActivityAt = Date.now();

/** Registra cualquier interacción del usuario (toque, scroll, teclado) para reiniciar el cronómetro de inactividad. */
export function recordUserActivity(): void {
  lastActivityAt = Date.now();
}

/**
 * Guardia de sesión basado en inactividad real del usuario + renovación silenciosa del JWT:
 * - Mientras el usuario siga interactuando con la pantalla, el cronómetro de inactividad se reinicia
 *   y el JWT se renueva automáticamente en segundo plano antes de expirar.
 * - Solo si el usuario deja de interactuar durante (5 min - sessionWarningSeconds) se muestra el aviso.
 * - Si llega a 0 segundos de inactividad (o falla la renovación), cierra la sesión de forma limpia.
 */
export function useSessionGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const expiresAt = useSessionStore((s) => s.session?.expiresAt);
  const remaining = useSessionStore((s) => s.remainingSeconds);
  const setRemaining = useSessionStore((s) => s.setRemainingSeconds);
  const [keepingAlive, setKeepingAlive] = useState(false);
  const silentRefreshingRef = useRef(false);

  // Al iniciar sesión reinicia el reloj de actividad
  useEffect(() => {
    if (isAuthenticated) {
      recordUserActivity();
    }
  }, [isAuthenticated]);

  // En Web escucha clicks, teclado y scroll globalmente para detectar actividad
  useEffect(() => {
    if (!isAuthenticated || Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }
    const onActivity = () => recordUserActivity();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('scroll', onActivity);
    };
  }, [isAuthenticated]);

  const tick = useCallback(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const now = Date.now();
    const idleRemainingSec = Math.ceil((lastActivityAt + IDLE_TIMEOUT_MS - now) / 1000);

    if (idleRemainingSec <= 0) {
      void endSessionLocally('inactivity');
      return;
    }

    setRemaining(idleRemainingSec);

    // Si el usuario está activo y el JWT está por caducar, lo renovamos en silencio
    const userIsActive = idleRemainingSec > env.sessionWarningSeconds;
    const jwtAlmostExpired = expiresAt - now <= SILENT_REFRESH_THRESHOLD_MS;
    if (userIsActive && jwtAlmostExpired && !silentRefreshingRef.current) {
      silentRefreshingRef.current = true;
      void refreshSession()
        .catch(() => {
          // Si el refresh token también venció, cerramos cuando expire el access token
          if (Date.now() >= expiresAt) {
            void endSessionLocally('refresh-failed');
          }
        })
        .finally(() => {
          silentRefreshingRef.current = false;
        });
    }
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
    recordUserActivity();
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
