export type PaymentKind = 'RECARGA' | 'SERVICIO';
export type PaymentStatus = 'PENDIENTE' | 'APLICADO' | 'RECHAZADO' | 'POR_CONFIRMAR';

export interface Product {
  id: number;
  name: string;
  serviceName: string;
  idServicio: number;
  idProducto: number;
  idCatTipoServicio?: number;
  tipoFront?: number;
  kind: PaymentKind | 'OTRO';
  /** Categoría legible traducida a partir de idCatTipoServicio / tipoFront. */
  category?: string;
  /** Descripción/instrucciones entregadas por GestoPago (<legend>). */
  description?: string;
  /** URL del logotipo del proveedor si estuviera disponible. */
  logoUrl?: string;
  /** Precio fijo (recargas). Undefined si es variable. */
  price?: number;
  referenceType?: string;
  hasCheckDigit: boolean;
  helpAvailable: boolean;
}

export interface ReferenceValidationInput {
  idServicio: number;
  idProducto: number;
  reference: string;
  amount?: number;
}

export interface ReferenceValidationResult {
  valid: boolean;
  status: 'VALIDA' | 'INVALIDA';
  validationId?: string;
  idServicio: number;
  idProducto: number;
  reference: string;
  serviceName?: string;
  productName?: string;
  category?: string;
  description?: string;
  holderName?: string;
  amountDue?: number;
  validatedAmount?: number;
  message: string;
}

export interface PaymentInput {
  accountNumber: string;
  product: Product;
  kind: PaymentKind;
  phone?: string;
  reference?: string;
  amount?: number;
  /** En pagos de SERVICIO, indica que la referencia ya fue validada con éxito. */
  referenceValidated?: boolean;
  /** En dispositivo móvil, solicita confirmación biométrica con huella digital. */
  useBiometricConfirmation?: boolean;
  /** Token biométrico de confirmación de un solo uso si ya fue emitido previamente. */
  confirmationToken?: string;
}

export interface PaymentReceipt {
  id?: number;
  applied: boolean;
  status: PaymentStatus;
  message: string;
  authorization?: string;
  transactionId?: number;
  upc?: string;
  gatewayCode?: string;
  amount?: number;
  kind: PaymentKind;
  productName: string;
  serviceName: string;
  logoUrl?: string;
  destination: string;
  accountNumber: string;
  createdAt: string;
}
