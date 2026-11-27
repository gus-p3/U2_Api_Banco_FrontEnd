import type { AxiosInstance } from 'axios';

import type { AuthRepository } from '../domain/ports';
import type {
  AuthChallengeStatusDto,
  AuthRequestDto,
  AuthResponseDto,
  BiometricLoginRequestDto,
  BiometricRegisterRequestDto,
  ChallengeActionRequestDto,
  OperationConfirmRequestDto,
  OperationConfirmResponseDto,
  PendingLogin2faDto,
  RefreshTokenRequestDto,
  VerifyCodeRequestDto,
} from './dto';
import { toAuthResult, toLoginOutcome } from './mappers';

/** Implementación HTTP del repositorio de autenticación. Recibe el cliente por inyección (testeable). */
export function createAuthRepository(client: AxiosInstance): AuthRepository {
  return {
    async login(email, password) {
      const body: AuthRequestDto = { email, password };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/login', body, { skipAuth: true });
      return toAuthResult(data);
    },

    async loginChannel(email, password, channel) {
      const body: AuthRequestDto = { email, password, channel };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/login', body, { skipAuth: true });
      return toLoginOutcome(data);
    },

    async verifyChallengeCode(challengeId, pollToken, code) {
      const body: VerifyCodeRequestDto = { challengeId, pollToken, code };
      const { data } = await client.post<AuthResponseDto>('/v1/auth/verificar-codigo', body, {
        skipAuth: true,
      });
      return toAuthResult(data);
    },

    async sendChallengeCode(challengeId, pollToken) {
      const body: ChallengeActionRequestDto = { challengeId, pollToken };
      const { data } = await client.post<AuthChallengeStatusDto>('/v1/auth/2fa/enviar-codigo', body, {
        skipAuth: true,
      });
      return data;
    },

    async requestChallengeBiometric(challengeId, pollToken) {
      const body: ChallengeActionRequestDto = { challengeId, pollToken };
      const { data } = await client.post<AuthChallengeStatusDto>('/v1/auth/2fa/solicitar-huella', body, {
        skipAuth: true,
      });
      return data;
    },

    async getChallengeStatus(challengeId, pollToken) {
      const body: ChallengeActionRequestDto = { challengeId, pollToken };
      const { data } = await client.post<AuthChallengeStatusDto>('/v1/auth/2fa/estado', body, {
        skipAuth: true,
      });
      return data;
    },

    async cancelChallenge(challengeId, pollToken) {
      const body: ChallengeActionRequestDto = { challengeId, pollToken };
      const { data } = await client.post<AuthChallengeStatusDto>('/v1/auth/2fa/cancelar', body, {
        skipAuth: true,
      });
      return data;
    },

    async getPendingLogin2fa() {
      const { data } = await client.get<PendingLogin2faDto[]>('/v1/auth/2fa/pendientes');
      return Array.isArray(data) ? data : [];
    },

    async approveLogin2fa(challengeId, confirmationToken) {
      const { data } = await client.post<PendingLogin2faDto>(
        `/v1/auth/2fa/${encodeURIComponent(challengeId)}/aprobar`,
        {},
        { headers: { 'X-Confirmation-Token': confirmationToken } },
      );
      return data;
    },

    async rejectLogin2fa(challengeId) {
      const { data } = await client.post<PendingLogin2faDto>(
        `/v1/auth/2fa/${encodeURIComponent(challengeId)}/rechazar`,
      );
      return data;
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

    async confirmOperation(params) {
      const body: OperationConfirmRequestDto = {
        password: params.password,
        biometricType: params.biometricType,
        biometricData: params.biometricData,
      };
      const { data } = await client.post<OperationConfirmResponseDto>(
        '/v1/auth/confirmar-operacion',
        body,
      );
      return data.confirmationToken;
    },

    async logout() {
      // El backend revoca el refresh token del dueño del JWT (Authorization: Bearer).
      await client.post('/v1/auth/logout');
    },
  };
}
