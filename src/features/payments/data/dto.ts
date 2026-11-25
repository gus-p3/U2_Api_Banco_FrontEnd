export interface ProductDto {
  id: number;
  producto: string;
  servicio: string;
  idServicio: number;
  idProducto: number;
  idCatTipoServicio?: number;
  tipoFront?: number;
  hasDigitoVerificador?: boolean;
  tipoReferencia?: string;
  precio?: string;
  showAyuda?: boolean;
  legend?: string;
  categoria?: string;
  createdAt?: string;
}

/** Cuerpo exacto de POST /v1/pagos. No se envían campos extra. */
export interface PagoRequestDto {
  numCuenta: string;
  idServicio: number;
  idProducto: number;
  tipoPago: 'RECARGA' | 'SERVICIO';
  telefono?: string;
  referencia?: string;
  monto?: number;
}

export interface PagoResponseDto {
  codigo: number;
  mensaje: string;
  estado: 'PENDIENTE' | 'APLICADO' | 'RECHAZADO' | 'POR_CONFIRMAR';
  codigoGestoPago?: string;
  numAutorizacion?: string;
  idTx?: number;
  upc?: string;
}

export interface ValidateReferenceRequestDto {
  idServicio: number;
  idProducto: number;
  referencia: string;
  monto?: number;
}

export interface ValidateReferenceResponseDto {
  valida: boolean;
  estadoValidacion: 'VALIDA' | 'INVALIDA';
  validationId?: string;
  idServicio: number;
  idProducto: number;
  referencia: string;
  nombreServicio?: string;
  nombreProducto?: string;
  categoria?: string;
  descripcion?: string;
  titular?: string;
  adeudo?: number;
  montoValidado?: number;
  mensaje: string;
}

export interface PagoDetalleDto {
  id: number;
  codigo: number;
  mensaje: string;
  estado: 'PENDIENTE' | 'APLICADO' | 'RECHAZADO' | 'POR_CONFIRMAR';
  tipoPago: 'RECARGA' | 'SERVICIO';
  numCuenta: string;
  idServicio: number;
  idProducto: number;
  nombreServicio: string;
  nombreProducto: string;
  categoria?: string;
  telefono?: string;
  referencia?: string;
  destinoEnmascarado?: string;
  monto: number;
  comision?: number;
  codigoGestoPago?: string;
  numAutorizacion?: string;
  idTx?: number;
  upc?: string;
  fechaEnvio?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}
