export type AuthMethod = 'PASSWORD' | 'BIOMETRIC_HUELLA' | 'BIOMETRIC_FACIAL' | 'REFRESH';
export type BiometricType = 'HUELLA' | 'FACIAL';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session {
  email: string;
  idClient: number;
  authMethod: AuthMethod;
  hasBiometricRegistered: boolean;
  biometricType?: BiometricType;
  lastLoginAt?: string;
}

export interface AuthResult {
  session: Session;
  tokens: Tokens;
}

export interface ServerSessionStatus {
  isLoggedIn: boolean;
  remainingSeconds: number;
  maxInactivitySeconds: number;
  userEmail?: string;
}
