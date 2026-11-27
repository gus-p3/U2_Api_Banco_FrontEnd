/** DTOs exactos del backend (nombres de campo reales). Los nulos se omiten → opcionales. */
export interface AuthRequestDto {
  email: string;
  password: string;
  channel?: 'WEB' | 'MOBILE';
}

export interface BiometricLoginRequestDto {
  email: string;
  biometricType: 'HUELLA' | 'FACIAL';
  biometricData: string;
  deviceId?: string;
}

export interface BiometricRegisterRequestDto {
  idClient: number;
  biometricType: 'HUELLA' | 'FACIAL';
  biometricData: string;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface OperationConfirmRequestDto {
  password?: string;
  biometricType?: 'HUELLA' | 'FACIAL';
  biometricData?: string;
}

export interface OperationConfirmResponseDto {
  confirmationToken: string;
  expiresInSeconds: number;
}

export interface ChallengeActionRequestDto {
  challengeId: string;
  pollToken: string;
}

export interface VerifyCodeRequestDto {
  challengeId: string;
  pollToken: string;
  code: string;
}

export interface AuthResponseDto {
  token?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  email: string;
  isActive?: boolean;
  emailVerified?: boolean;
  hasBiometricRegistered?: boolean;
  biometricType?: 'HUELLA' | 'FACIAL';
  lastLoginAt?: string;
  requiresVerification?: boolean;
  verificationPurpose?: 'EMAIL_VERIFICATION' | 'LOGIN_2FA';
  challengeId?: string;
  pollToken?: string;
  availableMethods?: Array<'EMAIL_CODE' | 'MOBILE_BIOMETRIC'>;
  codeSent?: boolean;
  challengeExpiresIn?: number;
}

export interface AuthChallengeStatusDto {
  challengeId: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO' | 'CONSUMIDO';
  purpose: 'EMAIL_VERIFICATION' | 'LOGIN_2FA';
  channel: 'WEB' | 'MOBILE';
  email: string;
  allowBiometric?: boolean;
  biometricRequested?: boolean;
  codeSent?: boolean;
  expiraEn?: string;
  authResponse?: AuthResponseDto;
}

export interface PendingLogin2faDto {
  challengeId: string;
  email: string;
  channel: 'WEB' | 'MOBILE';
  expiraEn: string;
  fechaCreacion?: string;
}
