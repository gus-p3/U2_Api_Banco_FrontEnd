import { http } from '@/core/http/client';

import { createAuthRepository } from './data/authRepository';
import { biometricGateway, secretStore } from './data/deviceAdapters';

/** Raíz de composición de la feature auth (inyección de dependencias manual). */
export const authRepository = createAuthRepository(http);
export const authDeps = { repo: authRepository, store: secretStore, biometrics: biometricGateway };
