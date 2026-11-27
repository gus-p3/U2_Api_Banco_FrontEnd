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

export type Login2faMethod = 'EMAIL_CODE' | 'MOBILE_BIOMETRIC';
export type VerificationPurpose = 'EMAIL_VERIFICATION' | 'LOGIN_2FA';

export interface AuthChallenge {
  email: string;
  purpose: VerificationPurpose;
  challengeId: string;
  pollToken: string;
  availableMethods: Login2faMethod[];
  codeSent: boolean;
  hasBiometricRegistered: boolean;
  expiresInSeconds: number;
}

export type LoginOutcome =
  { kind: 'authenticated'; auth: AuthResult } | { kind: 'challenge'; challenge: AuthChallenge };
