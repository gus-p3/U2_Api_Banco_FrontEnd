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
