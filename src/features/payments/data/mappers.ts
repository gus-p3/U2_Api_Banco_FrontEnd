import type {
  PaymentInput,
  PaymentReceipt,
  Product,
  ReferenceValidationResult,
} from '../domain/entities';
import type {
  PagoDetalleDto,
  PagoRequestDto,
  PagoResponseDto,
  ProductDto,
  ValidateReferenceResponseDto,
} from './dto';

const parsePrice = (precio: string | undefined): number | undefined => {
  if (!precio) return undefined;
  const n = Number(precio.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Construye la URL oficial del logotipo del servicio en GestoPago a partir de idServicio. */
export function buildGestoPagoLogoUrl(idServicio?: number): string | undefined {
  if (typeof idServicio !== 'number' || !Number.isFinite(idServicio) || idServicio <= 0) {
    return undefined;
  }
  return `https://gestopago.portalventas.net/sistema/images/gestopago/servicios/${idServicio}.png`;
}

/** Traduce la categoría desde idCatTipoServicio y tipoFront cuando el backend no la envía ya traducida. */
export function translateCategory(idCatTipoServicio?: number, tipoFront?: number): string {
  switch (idCatTipoServicio) {
    case 1:
      return 'Recargas';
    case 2:
      return 'Servicios';
    case 3:
      return 'Telecomunicaciones y TV';
    case 4:
      return 'Agua y Gobierno';
    case 10:
    case 11:
      return 'Pines y Entretenimiento';
    default:
      break;
  }
  switch (tipoFront) {
    case 1:
      return 'Recargas';
    case 2:
      return 'Servicios';
    case 4:
      return 'Pines y Entretenimiento';
    default:
      return 'Otros servicios';
  }
}

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
  idCatTipoServicio: dto.idCatTipoServicio,
  tipoFront: dto.tipoFront,
  kind: kindOf(dto),
  category: dto.categoria?.trim() || translateCategory(dto.idCatTipoServicio, dto.tipoFront),
  description: dto.legend?.trim() || undefined,
  logoUrl: buildGestoPagoLogoUrl(dto.idServicio),
  price: parsePrice(dto.precio),
  referenceType: dto.tipoReferencia,
  hasCheckDigit: dto.hasDigitoVerificador ?? false,
  helpAvailable: dto.showAyuda ?? false,
});

export function toReferenceValidationResult(
  dto: ValidateReferenceResponseDto,
): ReferenceValidationResult {
  return {
    valid: Boolean(dto.valida),
    status: dto.estadoValidacion,
    validationId: dto.validationId,
    idServicio: dto.idServicio,
    idProducto: dto.idProducto,
    reference: dto.referencia,
    serviceName: dto.nombreServicio,
    productName: dto.nombreProducto,
    category: dto.categoria,
    description: dto.descripcion,
    holderName: dto.titular,
    amountDue: dto.adeudo,
    validatedAmount: dto.montoValidado,
    message: dto.mensaje,
  };
}

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
    applied: dto.estado === 'APLICADO',
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
    logoUrl: input.product.logoUrl ?? buildGestoPagoLogoUrl(input.product.idServicio),
    destination: input.kind === 'RECARGA' ? (input.phone ?? '') : (input.reference ?? ''),
    accountNumber: input.accountNumber,
    createdAt: new Date().toISOString(),
  };
}

export function toReceiptFromDetail(dto: PagoDetalleDto, prev?: PaymentReceipt): PaymentReceipt {
  return {
    id: dto.id,
    applied: dto.estado === 'APLICADO',
    status: dto.estado,
    message: dto.mensaje,
    authorization: dto.numAutorizacion,
    transactionId: dto.idTx,
    upc: dto.upc,
    gatewayCode: dto.codigoGestoPago,
    amount: dto.monto ?? prev?.amount,
    kind: dto.tipoPago,
    productName: dto.nombreProducto || prev?.productName || '',
    serviceName: dto.nombreServicio || prev?.serviceName || '',
    logoUrl: buildGestoPagoLogoUrl(dto.idServicio) || prev?.logoUrl,
    destination:
      dto.tipoPago === 'RECARGA'
        ? (dto.telefono ?? dto.destinoEnmascarado ?? prev?.destination ?? '')
        : (dto.referencia ?? dto.destinoEnmascarado ?? prev?.destination ?? ''),
    accountNumber: dto.numCuenta || prev?.accountNumber || '',
    createdAt: dto.fechaCreacion ?? dto.fechaEnvio ?? prev?.createdAt ?? new Date().toISOString(),
  };
}
