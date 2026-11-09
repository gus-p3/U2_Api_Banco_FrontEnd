import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';

import type { PaymentsRepository } from '../domain/usecases';
import type { PagoResponseDto, ProductDto } from './dto';
import { toPagoRequest, toProduct, toReceipt } from './mappers';

/**
 * Catálogo base de respaldo cuando el entorno cloud (Railway) tiene la tabla/caché
 * de productos vacía por no contar aún con token externo de GestoPago activo.
 */
const FALLBACK_PRODUCTS_DTO: ProductDto[] = [
  {
    id: 6,
    producto: 'Recarga Amigo 50',
    servicio: 'Telcel',
    idServicio: 133,
    idProducto: 581,
    idCatTipoServicio: 1,
    tipoFront: 1,
    hasDigitoVerificador: false,
    tipoReferencia: 'Celular 10 dígitos',
    precio: '50.00',
    showAyuda: false,
  },
  {
    id: 4,
    producto: 'Recarga Amigo 100',
    servicio: 'Telcel',
    idServicio: 133,
    idProducto: 582,
    idCatTipoServicio: 1,
    tipoFront: 1,
    hasDigitoVerificador: false,
    tipoReferencia: 'Celular 10 dígitos',
    precio: '100.00',
    showAyuda: false,
  },
  {
    id: 1,
    producto: 'Recarga AT&T 100',
    servicio: 'AT&T',
    idServicio: 134,
    idProducto: 601,
    idCatTipoServicio: 1,
    tipoFront: 1,
    hasDigitoVerificador: false,
    tipoReferencia: 'Celular 10 dígitos',
    precio: '100.00',
    showAyuda: false,
  },
  {
    id: 2,
    producto: 'Pago de Luz CFE',
    servicio: 'CFE',
    idServicio: 79,
    idProducto: 209,
    idCatTipoServicio: 2,
    tipoFront: 2,
    hasDigitoVerificador: true,
    tipoReferencia: 'Referencia CFE (12-30 dígitos)',
    precio: '0.00',
    showAyuda: true,
  },
  {
    id: 3,
    producto: 'Internet y TV Izzi',
    servicio: 'Izzi',
    idServicio: 85,
    idProducto: 310,
    idCatTipoServicio: 2,
    tipoFront: 2,
    hasDigitoVerificador: false,
    tipoReferencia: 'Número de cuenta Izzi',
    precio: '0.00',
    showAyuda: true,
  },
  {
    id: 5,
    producto: 'Totalplay Residencial',
    servicio: 'Totalplay',
    idServicio: 88,
    idProducto: 412,
    idCatTipoServicio: 2,
    tipoFront: 2,
    hasDigitoVerificador: false,
    tipoReferencia: 'Cuenta Totalplay',
    precio: '0.00',
    showAyuda: false,
  },
];

export function createPaymentsRepository(client: AxiosInstance): PaymentsRepository {
  return {
    async getProducts() {
      const { data } = await client.get<ProductDto[]>('/v1/productos/redis');
      const source = Array.isArray(data) && data.length > 0 ? data : FALLBACK_PRODUCTS_DTO;
      return source.map(toProduct).filter((p) => p.kind !== 'OTRO');
    },

    async pay(input) {
      const { data } = await client.post<PagoResponseDto>('/v1/pagos', toPagoRequest(input));
      return toReceipt(data, input);
    },
  };
}

export const paymentsRepository = createPaymentsRepository(http);
