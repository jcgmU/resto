import { ApiClient } from '../api';
import {
  TableDTO,
  TableStatus,
  ZoneDTO,
  CreateZoneRequest,
  UpdateZoneRequest,
} from '@packages/shared-types';

export async function fetchTables(): Promise<TableDTO[]> {
  const res = await ApiClient.request('/v1/tables');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tables)) return payload.tables;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function createTable(data: {
  label: string;
  zoneId?: string;
  capacity?: number;
  status?: TableStatus;
}): Promise<TableDTO> {
  const res = await ApiClient.request('/v1/tables', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res?.data ?? res;
}

export async function updateTable(
  tableId: string,
  data: {
    label?: string;
    zoneId?: string;
    capacity?: number;
    status?: TableStatus;
  }
): Promise<TableDTO> {
  const res = await ApiClient.request(`/v1/tables/${tableId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res?.data ?? res;
}

export async function deleteTable(tableId: string): Promise<any> {
  const res = await ApiClient.request(`/v1/tables/${tableId}`, {
    method: 'DELETE',
  });
  return res?.data ?? res;
}

export async function staffOpenTableSession(tableId: string): Promise<any> {
  const res = await ApiClient.request('/v1/sessions/staff-open', {
    method: 'POST',
    body: JSON.stringify({ tableId }),
  });
  return res?.data ?? res;
}

export async function fetchZones(): Promise<ZoneDTO[]> {
  const res = await ApiClient.request('/v1/zones');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.zones)) return payload.zones;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function createZone(data: CreateZoneRequest): Promise<ZoneDTO> {
  const res = await ApiClient.request('/v1/zones', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res?.data ?? res;
}

export async function updateZone(zoneId: string, data: UpdateZoneRequest): Promise<ZoneDTO> {
  const res = await ApiClient.request(`/v1/zones/${zoneId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res?.data ?? res;
}

export async function deleteZone(zoneId: string): Promise<any> {
  const res = await ApiClient.request(`/v1/zones/${zoneId}`, {
    method: 'DELETE',
  });
  return res?.data ?? res;
}

export async function fetchTableQr(tableId: string): Promise<{ url: string; pngDataUrl: string }> {
  const res = await ApiClient.request(`/v1/tables/${tableId}/qr`);
  return res?.data ?? res;
}

export async function rotateTableQr(tableId: string): Promise<{ url: string; pngDataUrl: string }> {
  const res = await ApiClient.request(`/v1/tables/${tableId}/qr/rotate`, {
    method: 'POST',
  });
  return res?.data ?? res;
}
