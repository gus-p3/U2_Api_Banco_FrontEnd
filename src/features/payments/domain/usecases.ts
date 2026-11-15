import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';

import type {
  PaymentInput,
  PaymentReceipt,
  Product,
  ReferenceValidationInput,
  ReferenceValidationResult,
} from './entities';

export interface PaymentsRepository {
  getProducts(): Promise<Product[]>;
  validateReference(input: ReferenceValidationInput): Promise<ReferenceValidationResult>;
  pay(input: PaymentInput, confirmationToken: string): Promise<PaymentReceipt>;
  getPaymentStatus(idOrUpc: string, fallback?: PaymentReceipt): Promise<PaymentReceipt>;
}

export interface PayDeps {
  repo: PaymentsRepository;
  /** Obtiene un token de confirmación de un solo uso con la contraseña del usuario. */
  confirmWithPassword?: (password: string) => Promise<string>;
  /** Obtiene un token de confirmación de un solo uso con huella digital (móvil). */
  confirmWithFingerprint?: () => Promise<string>;
}

const failWith = (
  code: 'STRONG_AUTH_REQUIRED' | 'INVALID_PAYMENT_REQUEST' | 'REFERENCE_NOT_VALIDATED',
  message?: string,
): never => {
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
    if (!input.referenceValidated) {
      failWith('REFERENCE_NOT_VALIDATED');
    }
  }
}

/**
 * Caso de uso: pagar recarga o servicio (en web y móvil).
 * Requiere reautenticación reciente mediante contraseña o huella digital para obtener un
 * token de confirmación de un solo uso (header X-Confirmation-Token).
 */
export async function payProduct(deps: PayDeps, input: PaymentInput): Promise<PaymentReceipt> {
  validatePaymentInput(input);

  let confirmationToken = input.confirmationToken?.trim();

  if (!confirmationToken) {
    if (input.useBiometricConfirmation) {
      if (!deps.confirmWithFingerprint) {
        return failWith('STRONG_AUTH_REQUIRED');
      }
      confirmationToken = await deps.confirmWithFingerprint();
    } else if (input.confirmationPassword && input.confirmationPassword.trim().length > 0) {
      if (!deps.confirmWithPassword) {
        return failWith('STRONG_AUTH_REQUIRED');
      }
      confirmationToken = await deps.confirmWithPassword(input.confirmationPassword);
    } else {
      return failWith('STRONG_AUTH_REQUIRED');
    }
  }

  if (!confirmationToken) {
    return failWith('STRONG_AUTH_REQUIRED');
  }

  return deps.repo.pay(input, confirmationToken);
}

export const kindFromProduct = (product: Product): 'RECARGA' | 'SERVICIO' | 'OTRO' => product.kind;
