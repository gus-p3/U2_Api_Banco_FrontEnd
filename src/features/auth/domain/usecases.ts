import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';

import type { AuthResult } from './entities';
import type { AuthRepository, BiometricGateway, SecretStore } from './ports';

const BIOMETRIC_TYPE = 'HUELLA' as const;

const fail = (code: ConstructorParameters<typeof AppError>[0]['code']): never => {
  throw new AppError({ code, message: messageForCode(code) });
};

/** Login con correo y contraseña. Recuerda el correo para el login biométrico. */
export async function loginWithPassword(
  deps: { repo: AuthRepository; store: SecretStore },
  email: string,
  password: string,
): Promise<AuthResult> {
  const result = await deps.repo.login(email.trim(), password);
  await deps.store.saveLastEmail(result.session.email);
  return result;
}

/** Login con huella: valida el sensor local y envía el secreto enrolado en este dispositivo. */
export async function loginWithBiometrics(
  deps: { repo: AuthRepository; store: SecretStore; biometrics: BiometricGateway },
  email: string,
): Promise<AuthResult> {
  if (!(await deps.biometrics.isAvailable())) return fail('BIOMETRIC_UNAVAILABLE');
  const secret = await deps.store.getBiometricSecret(email);
  if (!secret) return fail('BIOMETRIC_NOT_ENROLLED');
  const ok = await deps.biometrics.authenticate('Confirma tu identidad para continuar');
  if (!ok) return fail('BIOMETRIC_CANCELLED');
  return deps.repo.loginBiometric(email, BIOMETRIC_TYPE, secret);
}

/** Activa la huella: genera un secreto local, lo registra en el backend y lo guarda cifrado. */
export async function enableBiometrics(
  deps: { repo: AuthRepository; store: SecretStore; biometrics: BiometricGateway },
  params: { idClient: number; email: string },
): Promise<void> {
  if (!(await deps.biometrics.isAvailable())) return fail('BIOMETRIC_UNAVAILABLE');
  const ok = await deps.biometrics.authenticate('Confirma tu huella para activar el acceso biométrico');
  if (!ok) return fail('BIOMETRIC_CANCELLED');
  const secret = await deps.biometrics.generateSecret();
  await deps.repo.enrollBiometric(params.idClient, BIOMETRIC_TYPE, secret);
  await deps.store.saveBiometricSecret(params.email, secret);
}

/** Cierra la sesión en servidor (best effort) y limpia secretos de sesión locales. */
export async function logout(deps: { repo: AuthRepository; store: SecretStore }): Promise<void> {
  try {
    await deps.repo.logout();
  } catch {
    // El token puede haber expirado ya: igual limpiamos localmente.
  } finally {
    await deps.store.clearRefreshToken();
  }
}
