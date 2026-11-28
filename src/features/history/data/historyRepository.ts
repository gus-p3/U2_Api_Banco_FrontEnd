import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';
import type { PagoDetalleDto } from '@/features/payments/data/dto';
import { buildGestoPagoLogoUrl } from '@/features/payments/data/mappers';

import type {
  HistoryRepository,
  PaymentHistoryFilters,
  PaymentHistoryItem,
  PaymentHistoryPage,
} from '../domain/entities';

export interface PagoHistorialPageDto {
  content: PagoDetalleDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export function toHistoryItem(dto: PagoDetalleDto): PaymentHistoryItem {
  const rawDest = dto.tipoPago === 'RECARGA' ? dto.telefono : dto.referencia;
  const masked = dto.destinoEnmascarado ?? rawDest ?? '';
  return {
    id: dto.id,
    applied: dto.estado === 'APLICADO',
    status: dto.estado,
    kind: dto.tipoPago,
    serviceName: dto.nombreServicio,
    productName: dto.nombreProducto,
    category: dto.categoria,
    logoUrl: buildGestoPagoLogoUrl(dto.idServicio),
    maskedDestination: masked,
    fullDestination: rawDest ?? masked,
    accountNumber: dto.numCuenta,
    amount: dto.monto,
    commission: dto.comision,
    authorization: dto.numAutorizacion,
    transactionId: dto.idTx,
    upc: dto.upc,
    gatewayCode: dto.codigoGestoPago,
    productLegend: dto.leyendaProducto,
    message: dto.mensaje,
    createdAt: dto.fechaCreacion ?? dto.fechaEnvio ?? new Date().toISOString(),
  };
}

export function createHistoryRepository(client: AxiosInstance): HistoryRepository {
  return {
    async getHistory(filters: PaymentHistoryFilters = {}): Promise<PaymentHistoryPage> {
      const params: Record<string, string | number> = {
        page: filters.page ?? 0,
        size: filters.size ?? 10,
      };
      if (filters.estado) params.estado = filters.estado;
      if (filters.desde?.trim()) params.desde = filters.desde.trim();
      if (filters.hasta?.trim()) params.hasta = filters.hasta.trim();

      const { data } = await client.get<PagoHistorialPageDto>('/v1/pagos', { params });
      return {
        items: (data.content ?? []).map(toHistoryItem),
        page: data.page ?? 0,
        size: data.size ?? 10,
        totalElements: data.totalElements ?? 0,
        totalPages: data.totalPages ?? 1,
        last: Boolean(data.last),
      };
    },

    async getHistoryDetail(idOrUpc: string): Promise<PaymentHistoryItem> {
      const { data } = await client.get<PagoDetalleDto>(
        `/v1/pagos/${encodeURIComponent(idOrUpc.trim())}`,
      );
      return toHistoryItem(data);
    },
  };
}

export const historyRepository = createHistoryRepository(http);
