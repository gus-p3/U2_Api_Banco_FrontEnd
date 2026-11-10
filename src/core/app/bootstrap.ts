import { configureAuthBridge } from '@/core/http/client';
import {
  endSessionLocally,
  refreshSession,
  restoreSession,
} from '@/features/auth/presentation/authActions';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';

let started = false;

/** Conecta el cliente HTTP con el estado de sesión y restaura la sesión guardada. Idempotente. */
export function bootstrapApp(): Promise<void> {
  if (started) return Promise.resolve();
  started = true;

  configureAuthBridge({
    getAccessToken: () => useSessionStore.getState().accessToken,
    refreshTokens: refreshSession,
    onSessionEnded: (reason) => {
      void endSessionLocally(reason);
    },
  });

  return restoreSession();
}
