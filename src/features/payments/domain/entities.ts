export type PaymentKind = 'RECARGA' | 'SERVICIO';
export type PaymentStatus = 'PENDIENTE' | 'APLICADO' | 'RECHAZADO' | 'POR_CONFIRMAR';

export interface Product {
  id: number;
  name: string;
  serviceName: string;
  idServicio: number;
  idProducto: number;
  kind: PaymentKind | 'OTRO';
  /** Precio fijo (recargas). Undefined si es variable. */
  price?: number;
  referenceType?: string;
  hasCheckDigit: boolean;
  helpAvailable: boolean;
}

export interface PaymentInput {
  accountNumber: string;
  product: Product;
  kind: PaymentKind;
  phone?: string;
  reference?: string;
  amount?: number;
}

export interface PaymentReceipt {
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
  destination: string;
  accountNumber: string;
  createdAt: string;
}
