import { ApiClient } from '../api';
import {
  ReservationDTO,
  CreateReservationRequest,
} from '@packages/shared-types';

export async function fetchReservations(filter?: {
  tableId?: string;
  date?: string;
}): Promise<ReservationDTO[]> {
  const query = new URLSearchParams();
  if (filter?.tableId) query.set('tableId', filter.tableId);
  if (filter?.date) query.set('date', filter.date);
  const qStr = query.toString();
  const url = `/v1/reservations${qStr ? `?${qStr}` : ''}`;
  const res = await ApiClient.request(url);
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.reservations)) return payload.reservations;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function createReservation(data: CreateReservationRequest): Promise<ReservationDTO> {
  const res = await ApiClient.request('/v1/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res?.data ?? res;
}

export async function cancelReservation(reservationId: string): Promise<ReservationDTO> {
  const res = await ApiClient.request(`/v1/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
  });
  return res?.data ?? res;
}

export async function seatReservation(reservationId: string): Promise<any> {
  const res = await ApiClient.request(`/v1/reservations/${reservationId}/seat`, {
    method: 'POST',
  });
  return res?.data ?? res;
}
