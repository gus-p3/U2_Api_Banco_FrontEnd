import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { env } from '@/core/config/env';
import { http } from '@/core/http/client';

import { authRepository } from '../di';
import { endSessionLocally, signOut } from './authActions';
import { selectIsAuthenticated, useSessionStore } from './sessionStore';

/**
 * Mantiene sincronizado el contador de inactividad con el servidor
 * (`GET /v1/auth/session-status`, que no renueva la actividad).
 * - Muestra aviso cuando quedan ≤ sessionWarningSeconds.
 * - Cierra de forma limpia cuando el servidor reporta sesión inactiva o tiempo agotado.
 * - `keepAlive` hace una petición protegida (renueva el temporizador del servidor).
 */
export function useSessionGuard() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const email = useSessionStore((s) => s.session?.email);
  const remaining = useSessionStore((s) => s.remainingSeconds);
  const setRemaining = useSessionStore((s) => s.setRemainingSeconds);
  const [keepingAlive, setKeepingAlive] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const status = await authRepository.getServerSessionStatus();
      const mismatch =
        status.userEmail && email && status.userEmail.toLowerCase() !== email.toLowerCase();
      if (!status.isLoggedIn || status.remainingSeconds <= 0 || mismatch) {
        await endSessionLocally('inactivity');
        return;
      }
      setRemaining(status.remainingSeconds);
    } catch {
      // Error de red transitorio: se reintenta en el siguiente ciclo.
    }
  }, [email, setRemaining]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    void poll();
    timer.current = setInterval(() => void poll(), env.sessionPollIntervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
    };
  }, [isAuthenticated, poll]);

  const showWarning = isAuthenticated && remaining !== null && remaining <= env.sessionWarningSeconds;

  // Cuenta regresiva segundo a segundo únicamente cuando el modal de advertencia está visible.
  useEffect(() => {
    if (!showWarning) return undefined;
    const t = setInterval(() => {
      const current = useSessionStore.getState().remainingSeconds;
      if (current === null) return;
      if (current <= 1) {
        void poll();
      } else {
        setRemaining(current - 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [showWarning, poll, setRemaining]);

  const keepAlive = useCallback(async () => {
    setKeepingAlive(true);
    try {
      await http.post('/v1/clientes/buscar', {});
      await poll();
    } catch {
      // Si falla por sesión, el interceptor ya cerró la sesión.
    } finally {
      setKeepingAlive(false);
    }
  }, [poll]);

  return { remaining, showWarning, keepAlive, keepingAlive, signOut };
}
