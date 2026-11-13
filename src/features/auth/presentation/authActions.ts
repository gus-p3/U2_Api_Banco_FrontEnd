import { authDeps } from '../di';
import type { AuthResult } from '../domain/entities';
import {
  enableBiometrics,
  loginWithBiometrics,
  loginWithPassword,
  logout as logoutUseCase,
} from '../domain/usecases';
import { useSessionStore, type EndReason } from './sessionStore';

/**
 * Acciones de sesión: orquestan casos de uso y actualizan el store.
 * Son funciones planas (no hooks) para poder usarlas desde interceptores y bootstrap.
 */
async function persistAndSet(result: AuthResult): Promise<AuthResult> {
  await authDeps.store.saveRefreshToken(result.tokens.refreshToken);
  useSessionStore.getState().setAuthenticated(result.session, result.tokens);
  return result;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const result = await loginWithPassword(authDeps, email, password);
  await persistAndSet(result);
}

export async function signInWithBiometrics(email: string): Promise<void> {
  const result = await loginWithBiometrics(authDeps, email);
  await authDeps.store.saveLastEmail(email);
  await persistAndSet(result);
}

/** Re-autentica con huella para obtener un token con authMethod=BIOMETRIC_HUELLA (requerido para pagar). */
export async function reauthenticateWithFingerprint(): Promise<void> {
  const email = useSessionStore.getState().session?.email;
  if (!email) throw new Error('Sin sesión activa');
  const result = await loginWithBiometrics(authDeps, email);
  await authDeps.store.saveRefreshToken(result.tokens.refreshToken);
  useSessionStore.getState().updateTokens(result.session, result.tokens);
}

export async function activateBiometrics(): Promise<void> {
  const session = useSessionStore.getState().session;
  if (!session) throw new Error('Sin sesión activa');
  await enableBiometrics(authDeps, { idClient: session.idClient, email: session.email });
  useSessionStore.getState().patchSession({ hasBiometricRegistered: true, biometricType: 'HUELLA' });
}

export async function deactivateBiometrics(): Promise<void> {
  const email = useSessionStore.getState().session?.email;
  if (email) await authDeps.store.removeBiometricSecret(email);
}

/** Renueva tokens con el refresh token vigente (rotación). Lanza si falla. */
export async function refreshSession(): Promise<string> {
  const { refreshToken } = useSessionStore.getState();
  const stored = refreshToken ?? (await authDeps.store.getRefreshToken());
  if (!stored) throw new Error('Sin refresh token');
  const result = await authDeps.repo.refresh(stored);
  await authDeps.store.saveRefreshToken(result.tokens.refreshToken);
  useSessionStore.getState().updateTokens(result.session, result.tokens);
  return result.tokens.accessToken;
}

/** Cierre de sesión voluntario: avisa al servidor y limpia el estado local. */
export async function signOut(): Promise<void> {
  await logoutUseCase(authDeps);
  useSessionStore.getState().setUnauthenticated('logout');
}

/** Cierre local inmediato (token vencido sin renovar o refresh fallido). */
export async function endSessionLocally(reason: EndReason): Promise<void> {
  if (useSessionStore.getState().status !== 'authenticated') return;
  useSessionStore.getState().setUnauthenticated(reason);
  await authDeps.store.clearRefreshToken();
}

/** Restaura la sesión al arrancar usando el refresh token guardado. */
export async function restoreSession(): Promise<void> {
  try {
    const stored = await authDeps.store.getRefreshToken();
    if (!stored) {
      useSessionStore.getState().setUnauthenticated();
      return;
    }
    const result = await authDeps.repo.refresh(stored);
    await persistAndSet(result);
  } catch {
    await authDeps.store.clearRefreshToken();
    useSessionStore.getState().setUnauthenticated();
  }
}
