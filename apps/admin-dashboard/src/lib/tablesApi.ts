import { ApiClient } from './api';
import { getUserRole, UserRole } from './auth';
import type { TableItem } from '../components/mesas/types';

export type CreateTablesBatchInput =
  | { prefix: string; count: number; start?: number }
  | { labels: string[] };

export interface TableUpdatePatch {
  tableId: string;
  label?: string;
  status?: 'active' | 'inactive';
}

export interface DeleteBatchFailedItem {
  tableId: string;
  code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND';
}

export interface DeleteTablesBatchResult {
  deleted: string[];
  failed: DeleteBatchFailedItem[];
}

export interface NormalizedTableApiError extends Error {
  status?: number;
  code: string;
  details?: any;
}

function normalizeTableItem(t: any): TableItem {
  return {
    ...t,
    tableId: t.tableId || t.id,
  };
}

function normalizeApiError(err: any, fallbackMessage: string): NormalizedTableApiError {
  const errObj =
    err && typeof err === 'object' && err.error && typeof err.error === 'object'
      ? err.error
      : err;
  const normalized: any =
    err instanceof Error
      ? err
      : new Error(errObj?.message || err?.message || fallbackMessage);
  if (!normalized.message) {
    normalized.message = fallbackMessage;
  }
  normalized.status = err?.status ?? errObj?.status;
  normalized.code = errObj?.code || err?.code || 'UNKNOWN';
  if ((errObj?.details ?? err?.details) !== undefined) {
    normalized.details = errObj?.details ?? err?.details;
  }
  return normalized;
}

export async function createTablesBatch(
  input: CreateTablesBatchInput
): Promise<{ tables: TableItem[] }> {
  try {
    const res = await ApiClient.request('/v1/tables/batch', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const payload = res?.data ?? res;
    const rawTables = Array.isArray(payload?.tables)
      ? payload.tables
      : Array.isArray(payload)
      ? payload
      : [];
    return {
      tables: rawTables.map(normalizeTableItem),
    };
  } catch (err) {
    throw normalizeApiError(err, 'Error al crear mesas en lote');
  }
}

export async function updateTablesBatch(
  updates: TableUpdatePatch[]
): Promise<{ tables: TableItem[] }> {
  try {
    const res = await ApiClient.request('/v1/tables/batch', {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
    const payload = res?.data ?? res;
    const rawTables = Array.isArray(payload?.tables)
      ? payload.tables
      : Array.isArray(payload)
      ? payload
      : [];
    return {
      tables: rawTables.map(normalizeTableItem),
    };
  } catch (err) {
    throw normalizeApiError(err, 'Error al actualizar mesas en lote');
  }
}

export async function updateTable(
  tableId: string,
  patch: { label?: string; status?: 'active' | 'inactive' }
): Promise<TableItem> {
  try {
    const res = await ApiClient.request(`/v1/tables/${encodeURIComponent(tableId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const payload = res?.data ?? res;
    const raw = payload?.table ?? payload;
    return normalizeTableItem(raw);
  } catch (err) {
    throw normalizeApiError(err, 'Error al actualizar la mesa');
  }
}

export async function deleteTablesBatch(
  tableIds: string[]
): Promise<DeleteTablesBatchResult> {
  try {
    const res = await ApiClient.request('/v1/tables/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ tableIds }),
    });
    const payload = res?.data ?? res;
    return {
      deleted: Array.isArray(payload?.deleted) ? payload.deleted : [],
      failed: Array.isArray(payload?.failed) ? payload.failed : [],
    };
  } catch (err) {
    throw normalizeApiError(err, 'Error al eliminar mesas');
  }
}

export function isMutationAllowed(
  role: UserRole | string | null | undefined,
  token?: string | null
): boolean {
  if (typeof role === 'string' && role.trim() !== '') {
    const normalized = role.trim().toUpperCase();
    if (normalized === 'ADMIN' || normalized === 'MANAGER') {
      return true;
    }
    if (normalized === 'STAFF') {
      return false;
    }
    return false;
  }

  if (typeof token === 'string' && /mock-(admin|manager)/i.test(token)) {
    return true;
  }

  return false;
}

export function canMutateTables(token: string | null = ApiClient.token): boolean {
  const role = getUserRole(token);
  return isMutationAllowed(role, token);
}
