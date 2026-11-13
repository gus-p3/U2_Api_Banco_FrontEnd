import type { AxiosInstance } from 'axios';

import type { AuthRepository } from '../domain/ports';
import type {
  AuthRequestDto,
  AuthResponseDto,
  BiometricLoginRequestDto,
  BiometricRegisterRequestDto,
  RefreshTokenRequestDto,
} from './dto';
import { toAuthResult } from './mappers';

/** Implementación HTTP del repositorio de autenticación. Recibe el cliente por inyección (testeable). */
export function createAuthRepository(client: AxiosInstance): AuthRepository {
  return {
    async login(email, password) {
      const body: AuthRequestDto = { email, password };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/login', body, { skipAuth: true });
      return toAuthResult(data);
    },

    async loginBiometric(email, biometricType, secret) {
      const body: BiometricLoginRequestDto = { email, biometricType, biometricData: secret };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/login-biometrico', body, {
        skipAuth: true,
      });
      return toAuthResult(data);
    },

    async enrollBiometric(idClient, biometricType, secret) {
      const body: BiometricRegisterRequestDto = { idClient, biometricType, biometricData: secret };
      // Requiere JWT: un cliente solo puede enrolar su propia biometría.
      await client.post<AuthResponseDto>('/v1/auth/biometria', body);
    },

    async refresh(refreshToken) {
      const body: RefreshTokenRequestDto = { refreshToken };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/refresh', body, { skipAuth: true });
      return toAuthResult(data);
    },

    async logout() {
      // El backend revoca el refresh token del dueño del JWT (Authorization: Bearer).
      await client.post('/v1/auth/logout');
    },
  };
}
