import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';
import { decodeJwt } from '@/core/utils/jwt';

import type { AuthResult } from '../domain/entities';
import type { AuthResponseDto } from './dto';

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
      role: claims.role === 'ADMIN' ? 'ADMIN' : 'CLIENT',
      expiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : undefined,
      hasBiometricRegistered: dto.hasBiometricRegistered ?? false,
      biometricType: dto.biometricType,
      lastLoginAt: dto.lastLoginAt,
    },
  };
}
