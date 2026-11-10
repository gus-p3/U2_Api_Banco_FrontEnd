import type { AuthResult, BiometricType, ServerSessionStatus } from './entities';

/** Puerto de acceso al backend de autenticación. */
export interface AuthRepository {
  login(email: string, password: string): Promise<AuthResult>;
  loginBiometric(email: string, biometricType: BiometricType, secret: string): Promise<AuthResult>;
  enrollBiometric(idClient: number, biometricType: BiometricType, secret: string): Promise<void>;
  refresh(refreshToken: string): Promise<AuthResult>;
  logout(email: string): Promise<void>;
  getServerSessionStatus(): Promise<ServerSessionStatus>;
}

/** Puerto del sensor biométrico del dispositivo. */
export interface BiometricGateway {
  isAvailable(): Promise<boolean>;
  /** Devuelve true si el usuario se autenticó; lanza AppError si no hay hardware/enrolamiento. */
  authenticate(promptMessage: string): Promise<boolean>;
  generateSecret(): Promise<string>;
}

/** Puerto de almacenamiento seguro de secretos y preferencias de sesión. */
export interface SecretStore {
  getBiometricSecret(email: string): Promise<string | null>;
  saveBiometricSecret(email: string, secret: string): Promise<void>;
  removeBiometricSecret(email: string): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  saveRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
  getLastEmail(): Promise<string | null>;
  saveLastEmail(email: string): Promise<void>;
}
