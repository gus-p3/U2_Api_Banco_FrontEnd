/** DTOs exactos del backend (nombres de campo reales). Los nulos se omiten → opcionales. */
export interface AuthRequestDto {
  email: string;
  password: string;
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

export interface AuthResponseDto {
  token: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
  email: string;
  isActive?: boolean;
  hasBiometricRegistered?: boolean;
  biometricType?: 'HUELLA' | 'FACIAL';
  lastLoginAt?: string;
}
