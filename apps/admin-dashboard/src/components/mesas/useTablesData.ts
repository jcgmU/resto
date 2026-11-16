import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api';
import type { TableItem, TableStatusInfo, ZoneItem } from './types';

export function getTableStatusInfo(
  table: TableItem,
  occupiedTableIds: Set<string>
): TableStatusInfo {
  const isInactive = table.status === 'inactive' || table.status === 'DISABLED' || table.status === 'deleted';
  const isOccupied = occupiedTableIds.has(table.tableId);
  if (isInactive) {
    return {
      label: 'Deshabilitada',
      tone: 'neutral',
      slotStatus: 'deshabilitada',
    };
  }
  if (isOccupied) {
    return {
      label: 'Ocupada',
      tone: 'error',
      slotStatus: 'ocupada',
    };
  }
  return {
    label: 'Disponible',
    tone: 'ok',
    slotStatus: 'libre',
  };
}

export function useTablesData() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set());
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTablesAndSessions = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [tablesRes, sessionsRes, zonesRes] = await Promise.all([
        ApiClient.request('/v1/tables', { method: 'GET' }),
        ApiClient.request('/v1/sessions?status=active', { method: 'GET' }).catch(() => ({
          data: [],
        })),
        ApiClient.request('/v1/zones', { method: 'GET' }).catch(() => ({ data: [] })),
      ]);

      const rawZones = Array.isArray(zonesRes) ? zonesRes : zonesRes?.data;
      setZones(
        Array.isArray(rawZones)
          ? rawZones.filter((z: any) => z && z.id && z.active !== false)
          : []
      );

      const rawTables = Array.isArray(tablesRes) ? tablesRes : tablesRes?.data;
      if (Array.isArray(rawTables)) {
        const normalizedTables: TableItem[] = rawTables
          .map((t: any) => ({ ...t, tableId: t.tableId || t.id }))
          .filter((t: TableItem) => t.status !== 'deleted' && !t.deletedAt);
        setTables(normalizedTables);
      } else {
        setTables([]);
      }

      const rawSessions = Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data;
      if (Array.isArray(rawSessions)) {
        const occupied = new Set<string>();
        rawSessions.forEach((s: any) => {
          if (s.tableId) {
            occupied.add(s.tableId);
          }
        });
        setOccupiedTableIds(occupied);
      } else {
        setOccupiedTableIds(new Set());
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las mesas');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTablesAndSessions();
    // El servicio de sesiones no emite eventos al admin: se sondea para que
    // una mesa aparezca ocupada poco después de que el comensal escanee el QR.
    const timer = setInterval(() => fetchTablesAndSessions(true), 5000);
    return () => clearInterval(timer);
  }, [fetchTablesAndSessions]);

  const getTableStatus = useCallback(
    (table: TableItem) => getTableStatusInfo(table, occupiedTableIds),
    [occupiedTableIds]
  );

  return {
    tables,
    zones,
    setTables,
    occupiedTableIds,
    loading,
    error,
    fetchTablesAndSessions,
    getTableStatus,
  };
}
