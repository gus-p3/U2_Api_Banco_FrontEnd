import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';
import { decodeJwt } from '@/core/utils/jwt';

import type { AuthResult, ServerSessionStatus } from '../domain/entities';
import type { AuthResponseDto, ServerSessionStatusDto } from './dto';

/** `idClient` no viaja en el cuerpo (JsonIgnore): se lee del claim del JWT. */
export function toAuthResult(dto: AuthResponseDto): AuthResult {
  const claims = decodeJwt(dto.token);
  if (!claims || typeof claims.idClient !== 'number') {
    throw new AppError({
      code: 'TOKEN_EXPIRED_OR_INVALID',
      message: messageForCode('TOKEN_EXPIRED_OR_INVALID'),
    });
  }
  return {
    tokens: { accessToken: dto.token, refreshToken: dto.refreshToken },
    session: {
      email: dto.email,
      idClient: claims.idClient,
      authMethod: claims.authMethod ?? 'PASSWORD',
      hasBiometricRegistered: dto.hasBiometricRegistered ?? false,
      biometricType: dto.biometricType,
      lastLoginAt: dto.lastLoginAt,
    },
  };
}

export function toServerSessionStatus(dto: ServerSessionStatusDto): ServerSessionStatus {
  return {
    isLoggedIn: dto.isLoggedIn ?? false,
    remainingSeconds: dto.remainingSeconds ?? 0,
    maxInactivitySeconds: dto.maxInactivitySeconds ?? 300,
    userEmail: dto.userEmail,
  };
}
