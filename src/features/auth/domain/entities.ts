export type AuthMethod = 'PASSWORD' | 'BIOMETRIC_HUELLA' | 'BIOMETRIC_FACIAL' | 'REFRESH';
export type BiometricType = 'HUELLA' | 'FACIAL';
export type Role = 'CLIENT' | 'ADMIN';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session {
  email: string;
  idClient: number;
  authMethod: AuthMethod;
  role: Role;
  /** Vencimiento del access token (epoch ms), tomado del claim `exp` del JWT. */
  expiresAt?: number;
  hasBiometricRegistered: boolean;
  biometricType?: BiometricType;
  lastLoginAt?: string;
}

export interface AuthResult {
  session: Session;
  tokens: Tokens;
}
