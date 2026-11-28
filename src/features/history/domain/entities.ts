import type { PaymentKind, PaymentStatus } from '@/features/payments/domain/entities';

export interface PaymentHistoryItem {
  id: number;
  applied: boolean;
  status: PaymentStatus;
  kind: PaymentKind;
  serviceName: string;
  productName: string;
  category?: string;
  logoUrl?: string;
  /** Referencia o teléfono parcialmente enmascarado para el listado. */
  maskedDestination: string;
  /** Referencia o teléfono en el detalle. */
  fullDestination: string;
  accountNumber: string;
  amount: number;
  commission?: number;
  authorization?: string;
  transactionId?: number;
  upc?: string;
  gatewayCode?: string;
  productLegend?: string;
  claimsInfo?: string;
  message: string;
  createdAt: string;
}

export interface PaymentHistoryFilters {
  estado?: PaymentStatus;
  desde?: string;
  hasta?: string;
  page?: number;
  size?: number;
}

export interface PaymentHistoryPage {
  items: PaymentHistoryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface HistoryRepository {
  getHistory(filters?: PaymentHistoryFilters): Promise<PaymentHistoryPage>;
  getHistoryDetail(idOrUpc: string): Promise<PaymentHistoryItem>;
}
