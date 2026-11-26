import { http } from '@/core/http/client';

import type { PaymentInput, PaymentKind, PaymentReceipt } from '../domain/entities';
import type { PagoResponseDto } from './dto';
import { toPagoRequest, toReceipt } from './mappers';

export type RemoteAuthStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EXPIRADO' | 'CANCELADO';

export interface PagoAutorizacionDto {
  idAutorizacion: string;
  estado: RemoteAuthStatus;
  tipoPago: PaymentKind;
  numCuenta: string;
  idServicio: number;
  idProducto: number;
  nombreServicio: string;
  nombreProducto: string;
  destinoEnmascarado?: string;
  monto: number;
  expiraEn: string;
  fechaCreacion?: string;
  resultadoPago?: PagoResponseDto;
}

export async function registerPushToken(
  token: string,
  plataforma: 'ANDROID' | 'IOS',
  deviceName?: string,
): Promise<void> {
  await http.post('/v1/dispositivos/push-token', {
    token,
    plataforma,
    deviceName,
  });
}

export async function requestRemotePaymentAuth(input: PaymentInput): Promise<PagoAutorizacionDto> {
  const { data } = await http.post<PagoAutorizacionDto>(
    '/v1/pagos/autorizaciones',
    toPagoRequest(input),
  );
  return data;
}

export async function getPendingRemoteAuthorizations(): Promise<PagoAutorizacionDto[]> {
  const { data } = await http.get<PagoAutorizacionDto[]>('/v1/pagos/autorizaciones/pendientes');
  return Array.isArray(data) ? data : [];
}

export async function getRemoteAuthorizationStatus(id: string): Promise<PagoAutorizacionDto> {
  const { data } = await http.get<PagoAutorizacionDto>(
    `/v1/pagos/autorizaciones/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function approveRemoteAuthorization(
  id: string,
  confirmationToken: string,
): Promise<PagoAutorizacionDto> {
  const { data } = await http.post<PagoAutorizacionDto>(
    `/v1/pagos/autorizaciones/${encodeURIComponent(id)}/aprobar`,
    {},
    { headers: { 'X-Confirmation-Token': confirmationToken } },
  );
  return data;
}

export async function rejectRemoteAuthorization(id: string): Promise<PagoAutorizacionDto> {
  const { data } = await http.post<PagoAutorizacionDto>(
    `/v1/pagos/autorizaciones/${encodeURIComponent(id)}/rechazar`,
  );
  return data;
}

export async function cancelRemoteAuthorization(id: string): Promise<PagoAutorizacionDto> {
  const { data } = await http.post<PagoAutorizacionDto>(
    `/v1/pagos/autorizaciones/${encodeURIComponent(id)}/cancelar`,
  );
  return data;
}

export function remoteAuthToReceipt(
  auth: PagoAutorizacionDto,
  input: PaymentInput,
): PaymentReceipt | null {
  if (!auth.resultadoPago) return null;
  return toReceipt(auth.resultadoPago, input);
}
