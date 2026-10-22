import { ApiClient } from '../api';
import {
  OrderDTO,
  OrderStatus,
  OrderHistoryEventDTO,
  ServiceCallDTO,
} from '@packages/shared-types';

export async function fetchOrders(): Promise<OrderDTO[]> {
  const res = await ApiClient.request('/v1/orders');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.orders)) return payload.orders;
  return [];
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  destination?: 'kitchen' | 'bar'
): Promise<OrderDTO> {
  const res = await ApiClient.request(`/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, destination }),
  });
  return res?.data ?? res;
}

export async function updateOrderDelay(
  orderId: string,
  delayMinutes: number
): Promise<OrderDTO> {
  const res = await ApiClient.request(`/v1/orders/${orderId}/delay`, {
    method: 'PATCH',
    body: JSON.stringify({ delayMinutes }),
  });
  return res?.data ?? res;
}

export async function fetchOrderHistory(
  orderId: string
): Promise<OrderHistoryEventDTO[]> {
  const res = await ApiClient.request(`/v1/orders/${orderId}/history`);
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.history)) return payload.history;
  return [];
}

export async function fetchServiceCalls(): Promise<ServiceCallDTO[]> {
  const res = await ApiClient.request('/v1/service-calls');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.calls)) return payload.calls;
  return [];
}

export async function resolveServiceCall(callId: string): Promise<any> {
  const res = await ApiClient.request(`/v1/service-calls/${callId}/resolve`, {
    method: 'PATCH',
  });
  return res?.data ?? res;
}
