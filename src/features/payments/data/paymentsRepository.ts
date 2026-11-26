import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';

import type { PaymentsRepository } from '../domain/usecases';
import type {
  PagoDetalleDto,
  PagoResponseDto,
  ProductDto,
  ValidateReferenceRequestDto,
  ValidateReferenceResponseDto,
} from './dto';
import {
  toPagoRequest,
  toProduct,
  toReceipt,
  toReceiptFromDetail,
  toReferenceValidationResult,
} from './mappers';

export function createPaymentsRepository(client: AxiosInstance): PaymentsRepository {
  return {
    async getProducts() {
      let source: ProductDto[] = [];
      try {
        const { data } = await client.get<ProductDto[]>('/v1/productos/redis');
        source = Array.isArray(data) ? data : [];
      } catch {
        source = [];
      }
      if (source.length === 0) {
        const { data } = await client.get<ProductDto[]>('/v1/productos');
        source = Array.isArray(data) ? data : [];
      }
      return source.map(toProduct).filter((p) => p.kind !== 'OTRO');
    },

    async validateReference(input) {
      const body: ValidateReferenceRequestDto = {
        idServicio: input.idServicio,
        idProducto: input.idProducto,
        referencia: input.reference.trim(),
        monto: input.amount,
      };
      const { data } = await client.post<ValidateReferenceResponseDto>('/v1/referencias/validar', body);
      return toReferenceValidationResult(data);
    },

    async pay(input, confirmationToken) {
      const { data } = await client.post<PagoResponseDto>('/v1/pagos', toPagoRequest(input), {
        headers: { 'X-Confirmation-Token': confirmationToken },
      });
      return toReceipt(data, input);
    },

    async getPaymentStatus(idOrUpc, fallback) {
      const { data } = await client.get<PagoDetalleDto>(
        `/v1/pagos/${encodeURIComponent(idOrUpc.trim())}`,
      );
      return toReceiptFromDetail(data, fallback);
    },
  };
}

export const paymentsRepository = createPaymentsRepository(http);
