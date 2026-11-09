import type { PaymentInput, PaymentReceipt, Product } from '../domain/entities';
import type { PagoRequestDto, PagoResponseDto, ProductDto } from './dto';

const parsePrice = (precio: string | undefined): number | undefined => {
  if (!precio) return undefined;
  const n = Number(precio.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Misma regla que el backend: RECARGA ⇒ tipoFront 1; SERVICIO ⇒ tipoFront 2 o idCatTipoServicio 10/11. */
function kindOf(dto: ProductDto): Product['kind'] {
  if (dto.tipoFront === 1) return 'RECARGA';
  if (dto.tipoFront === 2 || dto.idCatTipoServicio === 10 || dto.idCatTipoServicio === 11)
    return 'SERVICIO';
  return 'OTRO';
}

export const toProduct = (dto: ProductDto): Product => ({
  id: dto.id,
  name: dto.producto,
  serviceName: dto.servicio,
  idServicio: dto.idServicio,
  idProducto: dto.idProducto,
  kind: kindOf(dto),
  price: parsePrice(dto.precio),
  referenceType: dto.tipoReferencia,
  hasCheckDigit: dto.hasDigitoVerificador ?? false,
  helpAvailable: dto.showAyuda ?? false,
});

export function toPagoRequest(input: PaymentInput): PagoRequestDto {
  const base: PagoRequestDto = {
    numCuenta: input.accountNumber,
    idServicio: input.product.idServicio,
    idProducto: input.product.idProducto,
    tipoPago: input.kind,
  };
  return input.kind === 'RECARGA'
    ? { ...base, telefono: input.phone }
    : { ...base, referencia: input.reference, monto: input.amount };
}

export function toReceipt(dto: PagoResponseDto, input: PaymentInput): PaymentReceipt {
  return {
    applied: dto.codigo === 1 && dto.estado === 'APLICADO',
    status: dto.estado,
    message: dto.mensaje,
    authorization: dto.numAutorizacion,
    transactionId: dto.idTx,
    upc: dto.upc,
    gatewayCode: dto.codigoGestoPago,
    amount: input.kind === 'RECARGA' ? input.product.price : input.amount,
    kind: input.kind,
    productName: input.product.name,
    serviceName: input.product.serviceName,
    destination: input.kind === 'RECARGA' ? (input.phone ?? '') : (input.reference ?? ''),
    accountNumber: input.accountNumber,
    createdAt: new Date().toISOString(),
  };
}
