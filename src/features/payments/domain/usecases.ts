import { Platform } from 'react-native';

import { AppError } from '@/core/errors/AppError';
import { messageForCode } from '@/core/errors/errorMessages';
import {
  validatePaymentAmount,
  validatePhone10,
  validateServiceReference,
} from '@/core/validation/validators';

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
  /** Obtiene un token de confirmación de un solo uso exclusivamente con huella digital (móvil). */
  confirmWithFingerprint?: () => Promise<string>;
  /** Permite sobreescribir la verificación de plataforma en pruebas unitarias. */
  isMobilePlatform?: () => boolean;
}

const failWith = (
  code:
    | 'STRONG_AUTH_REQUIRED'
    | 'INVALID_PAYMENT_REQUEST'
    | 'REFERENCE_NOT_VALIDATED'
    | 'UNSUPPORTED_PLATFORM',
  message?: string,
): never => {
  throw new AppError({ code, message: message ?? messageForCode(code) });
};

/** Valida estrictamente todos los campos del pago antes de invocar al backend. */
export function validatePaymentInput(input: PaymentInput): void {
  if (!/^[0-9]{10}$/.test(input.accountNumber)) {
    failWith('INVALID_PAYMENT_REQUEST', 'Selecciona una cuenta válida de 10 dígitos.');
  }
  if (!input.product || input.product.idServicio <= 0 || input.product.idProducto <= 0) {
    failWith('INVALID_PAYMENT_REQUEST', 'Selecciona un producto válido del catálogo.');
  }
  if (input.kind === 'RECARGA') {
    const phoneErr = validatePhone10(input.phone ?? '');
    if (phoneErr) {
      failWith('INVALID_PAYMENT_REQUEST', phoneErr);
    }
    if (input.reference) {
      failWith('INVALID_PAYMENT_REQUEST', 'Una recarga no lleva referencia.');
    }
  } else {
    const refErr = validateServiceReference(input.reference ?? '', input.product);
    if (refErr) {
      failWith('INVALID_PAYMENT_REQUEST', refErr);
    }
    if (input.phone) {
      failWith('INVALID_PAYMENT_REQUEST', 'Un pago de servicio no lleva teléfono.');
    }
    const amtStr = input.amount !== undefined ? String(input.amount) : '';
    const amtErr = validatePaymentAmount(amtStr);
    if (amtErr) {
      failWith('INVALID_PAYMENT_REQUEST', amtErr);
    }
    if (!input.referenceValidated) {
      failWith('REFERENCE_NOT_VALIDATED');
    }
  }
}

/**
 * Caso de uso: pagar recarga o servicio.
 * Exclusivo de la app móvil (bloqueado en Web) y requiere obligatoriamente autorización
 * con huella digital para emitir el token de un solo uso (header X-Confirmation-Token).
 */
export async function payProduct(deps: PayDeps, input: PaymentInput): Promise<PaymentReceipt> {
  const mobileAllowed = deps.isMobilePlatform
    ? deps.isMobilePlatform()
    : Platform.OS !== 'web';

  if (!mobileAllowed) {
    return failWith('UNSUPPORTED_PLATFORM');
  }

  validatePaymentInput(input);

  let confirmationToken = input.confirmationToken?.trim();

  if (!confirmationToken) {
    if (!input.useBiometricConfirmation || !deps.confirmWithFingerprint) {
      return failWith('STRONG_AUTH_REQUIRED');
    }
    confirmationToken = await deps.confirmWithFingerprint();
  }

  if (!confirmationToken) {
    return failWith('STRONG_AUTH_REQUIRED');
  }

  return deps.repo.pay(input, confirmationToken);
}

export const kindFromProduct = (product: Product): 'RECARGA' | 'SERVICIO' | 'OTRO' => product.kind;
