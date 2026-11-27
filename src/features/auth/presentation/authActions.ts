import { Platform } from 'react-native';

import { authDeps } from '../di';
import type { AuthChallengeStatusDto, PendingLogin2faDto } from '../data/dto';
import { toAuthResult } from '../data/mappers';
import type { AuthResult, LoginOutcome } from '../domain/entities';
import {
  confirmOperationWithBiometrics,
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

export async function completeAuthChallenge(result: AuthResult): Promise<void> {
  await authDeps.store.saveLastEmail(result.session.email);
  await persistAndSet(result);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const result = await loginWithPassword(authDeps, email, password);
  await persistAndSet(result);
}

export async function signInWithPasswordChallenge(
  email: string,
  password: string,
): Promise<LoginOutcome> {
  const channel = Platform.OS === 'web' ? 'WEB' : 'MOBILE';
  if (authDeps.repo.loginChannel) {
    const outcome = await authDeps.repo.loginChannel(email.trim(), password, channel);
    await authDeps.store.saveLastEmail(email.trim().toLowerCase());
    if (outcome.kind === 'authenticated') {
      await persistAndSet(outcome.auth);
    }
    return outcome;
  }
  const result = await loginWithPassword(authDeps, email, password);
  await persistAndSet(result);
  return { kind: 'authenticated', auth: result };
}

export async function verifyEmailOrLoginCode(
  challengeId: string,
  pollToken: string,
  code: string,
): Promise<void> {
  if (!authDeps.repo.verifyChallengeCode) {
    throw new Error('Verificación de código no disponible');
  }
  const result = await authDeps.repo.verifyChallengeCode(challengeId, pollToken, code.trim());
  await completeAuthChallenge(result);
}

export async function send2faEmailCode(
  challengeId: string,
  pollToken: string,
): Promise<AuthChallengeStatusDto> {
  if (!authDeps.repo.sendChallengeCode) {
    throw new Error('Envío de código no disponible');
  }
  return authDeps.repo.sendChallengeCode(challengeId, pollToken);
}

export async function request2faMobileFingerprint(
  challengeId: string,
  pollToken: string,
): Promise<AuthChallengeStatusDto> {
  if (!authDeps.repo.requestChallengeBiometric) {
    throw new Error('Autorización biométrica remota no disponible');
  }
  return authDeps.repo.requestChallengeBiometric(challengeId, pollToken);
}

export async function poll2faChallengeStatus(
  challengeId: string,
  pollToken: string,
): Promise<AuthChallengeStatusDto> {
  if (!authDeps.repo.getChallengeStatus) {
    throw new Error('Consulta de desafío 2FA no disponible');
  }
  const status = await authDeps.repo.getChallengeStatus(challengeId, pollToken);
  if (status.authResponse?.token && status.authResponse?.refreshToken) {
    const auth = toAuthResult(status.authResponse);
    await completeAuthChallenge(auth);
  }
  return status;
}

export async function cancel2faChallenge(challengeId: string, pollToken: string): Promise<void> {
  if (authDeps.repo.cancelChallenge) {
    await authDeps.repo.cancelChallenge(challengeId, pollToken).catch(() => undefined);
  }
}

export async function getPendingLogin2faRequests(): Promise<PendingLogin2faDto[]> {
  if (!authDeps.repo.getPendingLogin2fa) return [];
  return authDeps.repo.getPendingLogin2fa();
}

export async function approvePendingLogin2fa(
  challengeId: string,
  confirmationToken: string,
): Promise<PendingLogin2faDto> {
  if (!authDeps.repo.approveLogin2fa) {
    throw new Error('Aprobación de acceso remoto no disponible');
  }
  return authDeps.repo.approveLogin2fa(challengeId, confirmationToken);
}

export async function rejectPendingLogin2fa(challengeId: string): Promise<PendingLogin2faDto> {
  if (!authDeps.repo.rejectLogin2fa) {
    throw new Error('Rechazo de acceso remoto no disponible');
  }
  return authDeps.repo.rejectLogin2fa(challengeId);
}

export async function signInWithBiometrics(email: string): Promise<void> {
  const result = await loginWithBiometrics(authDeps, email);
  await authDeps.store.saveLastEmail(email);
  await persistAndSet(result);
}

/** Re-autentica con huella para obtener un token con authMethod=BIOMETRIC_HUELLA. */
export async function reauthenticateWithFingerprint(): Promise<void> {
  const email = useSessionStore.getState().session?.email;
  if (!email) throw new Error('Sin sesión activa');
  const result = await loginWithBiometrics(authDeps, email);
  await authDeps.store.saveRefreshToken(result.tokens.refreshToken);
  useSessionStore.getState().updateTokens(result.session, result.tokens);
}

/** Obtiene un token de confirmación de un solo uso validando exclusivamente la huella digital registrada. */
export async function confirmPaymentWithFingerprint(): Promise<string> {
  const email = useSessionStore.getState().session?.email;
  if (!email) throw new Error('Sin sesión activa');
  return confirmOperationWithBiometrics(authDeps, email);
}

/** Indica si el dispositivo móvil tiene biometría disponible y enrolada para el usuario actual. */
export async function isBiometricConfirmationAvailable(): Promise<boolean> {
  const email = useSessionStore.getState().session?.email;
  if (!email) return false;
  const available = await authDeps.biometrics.isAvailable();
  if (!available) return false;
  const secret = await authDeps.store.getBiometricSecret(email);
  return Boolean(secret);
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
