import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';
import { isAppError } from '@/core/errors/AppError';

import type { PaymentInput, PaymentReceipt, Product } from './entities';

export interface PaymentsRepository {
  getProducts(): Promise<Product[]>;
  pay(input: PaymentInput): Promise<PaymentReceipt>;
}

export interface PayDeps {
  repo: PaymentsRepository;
  /** Método con el que se obtuvo el token vigente. */
  getAuthMethod: () => string | undefined;
  /** Obtiene un token con huella (pide biometría local). */
  reauthenticateWithFingerprint: () => Promise<void>;
  /** Pagos solo en Android (el web no tiene huella). */
  isSupportedPlatform: () => boolean;
}

const failWith = (code: 'UNSUPPORTED_PLATFORM' | 'INVALID_PAYMENT_REQUEST', message?: string): never => {
  throw new AppError({ code, message: message ?? messageForCode(code) });
};

/** Valida los datos del pago antes de llamar al backend. */
export function validatePaymentInput(input: PaymentInput): void {
  if (!/^[0-9]{10}$/.test(input.accountNumber))
    failWith('INVALID_PAYMENT_REQUEST', 'Selecciona una cuenta válida.');
  if (input.kind === 'RECARGA') {
    if (!input.phone || !/^[0-9]{10}$/.test(input.phone)) {
      failWith('INVALID_PAYMENT_REQUEST', 'El teléfono debe tener 10 dígitos.');
    }
    if (input.reference) failWith('INVALID_PAYMENT_REQUEST', 'Una recarga no lleva referencia.');
  } else {
    if (!input.reference || input.reference.length > 100) {
      failWith('INVALID_PAYMENT_REQUEST', 'Captura la referencia del servicio (máx. 100 caracteres).');
    }
    if (input.phone) failWith('INVALID_PAYMENT_REQUEST', 'Un pago de servicio no lleva teléfono.');
    if (!input.amount || input.amount <= 0 || Math.round(input.amount * 100) / 100 !== input.amount) {
      failWith('INVALID_PAYMENT_REQUEST', 'Captura un monto mayor a 0 con máximo 2 decimales.');
    }
  }
}

/**
 * Caso de uso: pagar recarga o servicio.
 * El backend exige un JWT de huella; si el token vigente es de otro tipo (login con contraseña
 * o token refrescado) se pide la huella y, ante STRONG_AUTH_REQUIRED, se reintenta una vez.
 */
export async function payProduct(deps: PayDeps, input: PaymentInput): Promise<PaymentReceipt> {
  if (!deps.isSupportedPlatform()) return failWith('UNSUPPORTED_PLATFORM');
  validatePaymentInput(input);

  if (deps.getAuthMethod() !== 'BIOMETRIC_HUELLA') {
    await deps.reauthenticateWithFingerprint();
  }

  try {
    return await deps.repo.pay(input);
  } catch (error) {
    if (isAppError(error) && error.code === 'STRONG_AUTH_REQUIRED') {
      await deps.reauthenticateWithFingerprint();
      return deps.repo.pay(input);
    }
    throw error;
  }
}

export const kindFromProduct = (product: Product): 'RECARGA' | 'SERVICIO' | 'OTRO' => product.kind;
