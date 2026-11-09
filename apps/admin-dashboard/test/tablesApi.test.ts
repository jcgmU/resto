import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiClient } from '../src/lib/api';
import {
  createTablesBatch,
  updateTablesBatch,
  updateTable,
  deleteTablesBatch,
  isMutationAllowed,
  canMutateTables,
} from '../src/lib/tablesApi';
import { useTablesData } from '../src/components/mesas/useTablesData';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

describe('tablesApi & useTablesData (U5)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-admin-token';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe('ApiClient.request soporta formato de error anidado { error: { code, message, details } }', () => {
    test('preserva code, message, status y details cuando session responde error anidado', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 409,
        headers: { get: () => 'application/json' },
        json: async () => ({
          error: {
            code: 'TABLE_LABEL_TAKEN',
            message: 'Nombre de mesa duplicado',
            details: { conflicts: ['Mesa 1'] },
          },
        }),
      })) as any;

      await expect(ApiClient.request('/v1/tables/batch', { method: 'POST' })).rejects.toMatchObject({
        status: 409,
        code: 'TABLE_LABEL_TAKEN',
        message: 'Nombre de mesa duplicado',
        details: { conflicts: ['Mesa 1'] },
      });
    });

    test('preserva compatibilidad con error plano { code, message, details }', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: { field: 'count' },
        }),
      })) as any;

      await expect(ApiClient.request('/v1/tables/batch', { method: 'POST' })).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: { field: 'count' },
      });
    });
  });

  describe('createTablesBatch', () => {
    test('envía POST /v1/tables/batch con { prefix, count, start } y devuelve { tables } normalizadas', async () => {
      const spy = jest.spyOn(ApiClient, 'request').mockResolvedValueOnce({
        status: 201,
        data: {
          tables: [
            { tableId: 'table-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
            { tableId: 'table-2', label: 'Mesa 2', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
          ],
        },
      });

      const res = await createTablesBatch({ prefix: 'Mesa', count: 2, start: 1 });

      expect(spy).toHaveBeenCalledWith('/v1/tables/batch', {
        method: 'POST',
        body: JSON.stringify({ prefix: 'Mesa', count: 2, start: 1 }),
      });
      expect(res.tables).toHaveLength(2);
      expect(res.tables[0].tableId).toBe('table-1');
    });

    test('envía POST /v1/tables/batch con { labels } y propaga error 409 con code y details', async () => {
      const apiErr: any = new Error('Etiqueta ocupada');
      apiErr.status = 409;
      apiErr.code = 'TABLE_LABEL_TAKEN';
      apiErr.details = { conflicts: ['Terraza 1'] };
      jest.spyOn(ApiClient, 'request').mockRejectedValueOnce(apiErr);

      await expect(createTablesBatch({ labels: ['Terraza 1'] })).rejects.toMatchObject({
        status: 409,
        code: 'TABLE_LABEL_TAKEN',
        message: 'Etiqueta ocupada',
        details: { conflicts: ['Terraza 1'] },
      });
    });
  });

  describe('updateTablesBatch y updateTable', () => {
    test('updateTablesBatch envía PATCH /v1/tables/batch con { updates }', async () => {
      const spy = jest.spyOn(ApiClient, 'request').mockResolvedValueOnce({
        status: 200,
        data: {
          tables: [
            { tableId: 'table-1', label: 'VIP 1', status: 'inactive', createdAt: '2026-10-27T10:00:00Z' },
          ],
        },
      });

      const updates = [{ tableId: 'table-1', label: 'VIP 1', status: 'inactive' as const }];
      const res = await updateTablesBatch(updates);

      expect(spy).toHaveBeenCalledWith('/v1/tables/batch', {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      });
      expect(res.tables).toEqual([
        { tableId: 'table-1', label: 'VIP 1', status: 'inactive', createdAt: '2026-10-27T10:00:00Z' },
      ]);
    });

    test('updateTable envía PATCH /v1/tables/:tableId con patch y devuelve TableItem', async () => {
      const spy = jest.spyOn(ApiClient, 'request').mockResolvedValueOnce({
        status: 200,
        data: { tableId: 'table-1', label: 'Barra 1', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
      });

      const updated = await updateTable('table-1', { label: 'Barra 1' });

      expect(spy).toHaveBeenCalledWith('/v1/tables/table-1', {
        method: 'PATCH',
        body: JSON.stringify({ label: 'Barra 1' }),
      });
      expect(updated.label).toBe('Barra 1');
    });
  });

  describe('deleteTablesBatch', () => {
    test('envía POST /v1/tables/batch/delete con { tableIds } y devuelve { deleted, failed }', async () => {
      const spy = jest.spyOn(ApiClient, 'request').mockResolvedValueOnce({
        status: 200,
        data: {
          deleted: ['table-1'],
          failed: [{ tableId: 'table-2', code: 'TABLE_HAS_ACTIVE_SESSION' }],
        },
      });

      const res = await deleteTablesBatch(['table-1', 'table-2']);

      expect(spy).toHaveBeenCalledWith('/v1/tables/batch/delete', {
        method: 'POST',
        body: JSON.stringify({ tableIds: ['table-1', 'table-2'] }),
      });
      expect(res).toEqual({
        deleted: ['table-1'],
        failed: [{ tableId: 'table-2', code: 'TABLE_HAS_ACTIVE_SESSION' }],
      });
    });

    test('propaga 409 TABLES_NOT_DELETABLE preservando details.failed', async () => {
      const err: any = new Error('Ninguna mesa pudo eliminarse');
      err.status = 409;
      err.code = 'TABLES_NOT_DELETABLE';
      err.details = {
        deleted: [],
        failed: [{ tableId: 'table-2', code: 'TABLE_HAS_ACTIVE_SESSION' }],
      };
      jest.spyOn(ApiClient, 'request').mockRejectedValueOnce(err);

      await expect(deleteTablesBatch(['table-2'])).rejects.toMatchObject({
        status: 409,
        code: 'TABLES_NOT_DELETABLE',
        details: {
          deleted: [],
          failed: [{ tableId: 'table-2', code: 'TABLE_HAS_ACTIVE_SESSION' }],
        },
      });
    });
  });

  describe('isMutationAllowed y canMutateTables', () => {
    test('permite ADMIN y MANAGER (case-insensitive) y bloquea STAFF', () => {
      expect(isMutationAllowed('ADMIN')).toBe(true);
      expect(isMutationAllowed('admin')).toBe(true);
      expect(isMutationAllowed('MANAGER')).toBe(true);
      expect(isMutationAllowed('manager')).toBe(true);
      expect(isMutationAllowed('STAFF')).toBe(false);
      expect(isMutationAllowed('staff')).toBe(false);
    });

    test('cuando role es null/undefined, solo permite tokens mock de test admin/manager y deniega el resto', () => {
      expect(isMutationAllowed(null)).toBe(false);
      expect(isMutationAllowed(undefined, null)).toBe(false);
      expect(isMutationAllowed(null, 'some-random-opaque-token')).toBe(false);
      expect(isMutationAllowed(null, 'mock-staff-token')).toBe(false);
      expect(isMutationAllowed(null, 'mock-admin-token')).toBe(true);
      expect(isMutationAllowed(undefined, 'mock-manager-token')).toBe(true);
    });

    test('canMutateTables decodifica el JWT real o aplica fallback seguro', () => {
      expect(canMutateTables(makeJwt({ role: 'ADMIN' }))).toBe(true);
      expect(canMutateTables(makeJwt({ role: 'MANAGER' }))).toBe(true);
      expect(canMutateTables(makeJwt({ role: 'STAFF' }))).toBe(false);
      expect(canMutateTables(null)).toBe(false);
      expect(canMutateTables('mock-admin-token')).toBe(true);
    });
  });

  describe('useTablesData (carga inicial y sondeo de 5 s)', () => {
    test('carga mesas y sesiones activas al montar y vuelve a sondear cada 5000 ms en modo silencioso', async () => {
      jest.useFakeTimers();

      let callCount = 0;
      jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
        if (url === '/v1/tables') {
          callCount += 1;
          return {
            status: 200,
            data: [
              { tableId: 'tbl-1', label: `Mesa ${callCount}`, status: 'active', createdAt: '2026-10-27T10:00:00Z' },
            ],
          };
        }
        if (url.startsWith('/v1/sessions')) {
          return {
            status: 200,
            data: callCount >= 2 ? [{ id: 's-1', tableId: 'tbl-1', status: 'active' }] : [],
          };
        }
        return { status: 200, data: {} };
      });

      const { result, unmount } = renderHook(() => useTablesData());

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(1);
      });
      expect(result.current.tables[0].label).toBe('Mesa 1');
      expect(result.current.occupiedTableIds.has('tbl-1')).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.tables[0].label).toBe('Mesa 2');
        expect(result.current.occupiedTableIds.has('tbl-1')).toBe(true);
      });

      unmount();
    });
  });
});
