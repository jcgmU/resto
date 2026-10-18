"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  BentoCard,
  BentoGrid,
  StatusChip,
  TabsPill,
  Skeleton,
  EmptyState,
  ErrorState,
  KpiDelta,
  FeatureGuard,
  Proximamente,
  getTableDisplayName,
  formatOrderNumber,
} from '@packages/ui-components';
import {
  TableDTO,
  TableStatus,
  ZoneDTO,
  ReservationDTO,
  OperatingMode,
  formatCOP,
  OrderDTO,
  computeOrderOverdue,
} from '@packages/shared-types';
import { ApiClient } from '../../../lib/api';
import {
  fetchTables,
  createTable,
  updateTable,
  deleteTable,
  staffOpenTableSession,
  fetchZones,
  createZone,
  updateZone,
  deleteZone,
  fetchTableQr,
  rotateTableQr,
} from '../../../lib/api/tables';
import {
  fetchReservations,
  createReservation,
  cancelReservation,
  seatReservation,
} from '../../../lib/api/reservations';
import {
  fetchTenantSettings,
  updateTenantSettings,
} from '../../../lib/api/settings';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SessionItem {
  id?: string;
  sessionId?: string;
  tableId: string;
  status: string;
}

interface OrderItem {
  id: string;
  status: string;
  total?: number;
  tableId?: string;
  createdAt?: string;
  estimatedMinutes?: number | null;
  delayMinutes?: number | null;
  overdue?: boolean;
}

interface ServiceCallItem {
  id: string;
  tableId: string;
  note?: string;
  status: string;
  createdAt?: string;
}

function isDateToday(isoOrDateStr: string): boolean {
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

export default function DashboardPage() {
  const router = useRouter();

  // Datos principales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tables, setTables] = useState<TableDTO[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCallItem[]>([]);

  // Settings de tenant
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('hybrid');
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState<number>(18);
  const lastPersistedSlaRef = useRef<number>(18);
  const [savingSettings, setSavingSettings] = useState(false);

  // Filtros
  const [tableFilter, setTableFilter] = useState<'TODAS' | 'LIBRES' | 'OCUPADAS' | 'RESERVADAS'>('TODAS');
  const [zoneFilter, setZoneFilter] = useState<string>('TODAS');

  // Notificaciones / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Crear Mesa
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [newTableZoneId, setNewTableZoneId] = useState<string>('');
  const [createTableError, setCreateTableError] = useState<string | null>(null);
  const [submittingTable, setSubmittingTable] = useState(false);

  // Modal Editar Mesa
  const [editingTable, setEditingTable] = useState<TableDTO | null>(null);
  const [editTableLabel, setEditTableLabel] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState<number>(4);
  const [editTableZoneId, setEditTableZoneId] = useState<string>('');
  const [editTableStatus, setEditTableStatus] = useState<TableStatus>('AVAILABLE');
  const [editTableError, setEditTableError] = useState<string | null>(null);
  const [submittingEditTable, setSubmittingEditTable] = useState(false);

  // Modal Eliminar Mesa
  const [deletingTable, setDeletingTable] = useState<TableDTO | null>(null);
  const [deleteTableError, setDeleteTableError] = useState<string | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Modal Zonas
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneSortOrder, setNewZoneSortOrder] = useState<number>(0);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [zoneActionError, setZoneActionError] = useState<string | null>(null);
  const [submittingZone, setSubmittingZone] = useState(false);

  // Modal Reservas
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [resTableId, setResTableId] = useState('');
  const [resCustomerName, setResCustomerName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resPartySize, setResPartySize] = useState<number>(2);
  const [resTime, setResTime] = useState('19:30');
  const [resNotes, setResNotes] = useState('');
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [submittingReservation, setSubmittingReservation] = useState(false);

  // Modal QR
  const [activeTableQr, setActiveTableQr] = useState<TableDTO | null>(null);
  const [qrData, setQrData] = useState<{ url: string; pngDataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const createTableModalRef = useRef<HTMLDivElement>(null);
  const editTableModalRef = useRef<HTMLDivElement>(null);
  const deleteTableModalRef = useRef<HTMLDivElement>(null);
  const zonesModalRef = useRef<HTMLDivElement>(null);
  const reservationModalRef = useRef<HTMLDivElement>(null);
  const qrModalRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        tablesRes,
        zonesRes,
        reservationsRes,
        sessionsRes,
        settingsRes,
        ordersRes,
        callsRes,
      ] = await Promise.all([
        fetchTables(),
        fetchZones().catch(() => []),
        fetchReservations().catch(() => []),
        ApiClient.request('/v1/sessions?status=active'),
        fetchTenantSettings().catch(() => ({ operatingMode: 'hybrid' as OperatingMode, estimatedPrepMinutes: 18 })),
        ApiClient.request('/v1/orders').catch(() => []),
        ApiClient.request('/v1/service-calls?status=pending').catch(() => []),
      ]);

      const normalizedTables: TableDTO[] = (Array.isArray(tablesRes) ? tablesRes : (tablesRes as any)?.data || []).map(
        (t: any) => ({
          ...t,
          tableId: t.tableId || t.id,
          capacity: t.capacity ?? 4,
        })
      );
      setTables(normalizedTables);

      const normalizedZones: ZoneDTO[] = Array.isArray(zonesRes) ? zonesRes : (zonesRes as any)?.data || [];
      setZones(normalizedZones);

      const normalizedReservations: ReservationDTO[] = Array.isArray(reservationsRes)
        ? reservationsRes
        : (reservationsRes as any)?.data || [];
      setReservations(normalizedReservations);

      const sessionsData = Array.isArray(sessionsRes) ? sessionsRes : (sessionsRes as any)?.data || [];
      setActiveSessions(sessionsData);

      const ordersData = Array.isArray(ordersRes) ? ordersRes : (ordersRes as any)?.data || [];
      setOrders(ordersData);

      const callsData = Array.isArray(callsRes) ? callsRes : (callsRes as any)?.data || [];
      setServiceCalls(callsData);

      if (settingsRes) {
        if (settingsRes.operatingMode) setOperatingMode(settingsRes.operatingMode as OperatingMode);
        if (typeof settingsRes.estimatedPrepMinutes === 'number') {
          setEstimatedPrepMinutes(settingsRes.estimatedPrepMinutes);
          lastPersistedSlaRef.current = settingsRes.estimatedPrepMinutes;
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Manejo de foco y Escape en modales
  const attachModalKeyHandler = (
    ref: React.RefObject<HTMLDivElement | null>,
    onClose: () => void
  ) => {
    return (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
  };

  useEffect(() => {
    if (!showCreateTableModal) return;
    const handler = attachModalKeyHandler(createTableModalRef, () => setShowCreateTableModal(false));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showCreateTableModal]);

  useEffect(() => {
    if (!editingTable) return;
    const handler = attachModalKeyHandler(editTableModalRef, () => setEditingTable(null));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingTable]);

  useEffect(() => {
    if (!deletingTable) return;
    const handler = attachModalKeyHandler(deleteTableModalRef, () => setDeletingTable(null));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deletingTable]);

  useEffect(() => {
    if (!showZonesModal) return;
    const handler = attachModalKeyHandler(zonesModalRef, () => setShowZonesModal(false));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showZonesModal]);

  useEffect(() => {
    if (!showReservationModal) return;
    const handler = attachModalKeyHandler(reservationModalRef, () => setShowReservationModal(false));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showReservationModal]);

  useEffect(() => {
    if (!activeTableQr) return;
    const handler = attachModalKeyHandler(qrModalRef, () => setActiveTableQr(null));
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTableQr]);

  // Sesiones activas y Reservas activas de hoy
  const activeSessionTableIds = useMemo(() => {
    const s = new Set<string>();
    activeSessions.forEach((sess) => {
      if (sess.tableId && (sess.status === 'active' || !sess.status)) s.add(sess.tableId);
    });
    return s;
  }, [activeSessions]);

  const activeReservationsToday = useMemo(() => {
    return reservations.filter(
      (r) => r.status === 'active' && isDateToday(r.reservedFor)
    );
  }, [reservations]);

  const todayReservedTableIds = useMemo(() => {
    return new Set(activeReservationsToday.map((r) => r.tableId));
  }, [activeReservationsToday]);

  // Mapeo y estado de cada mesa
  const enrichedTables = useMemo(() => {
    return tables.map((t) => {
      const isOccupied = activeSessionTableIds.has(t.tableId) || t.status === 'OCCUPIED';
      const isReserved = !isOccupied && (todayReservedTableIds.has(t.tableId) || t.status === 'RESERVED');
      const isDisabled = t.status === 'DISABLED' || t.status === 'inactive';

      let effectiveStatus: 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'DESHABILITADA' = 'LIBRE';
      if (isDisabled) effectiveStatus = 'DESHABILITADA';
      else if (isOccupied) effectiveStatus = 'OCUPADA';
      else if (isReserved) effectiveStatus = 'RESERVADA';

      // Consumo estimado en órdenes activas
      const tableOrders = orders.filter(
        (o) => o.tableId === t.tableId && ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
      );
      const totalCop = tableOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const zoneObj = zones.find((z) => z.id === t.zoneId);
      const zoneName = zoneObj?.name || 'Salón Principal';

      return {
        ...t,
        effectiveStatus,
        capacity: t.capacity ?? 4,
        zoneName,
        currentBillCop: totalCop,
      };
    });
  }, [tables, activeSessionTableIds, todayReservedTableIds, zones, orders]);

  // Métricas para las 3 tarjetas superiores
  const metrics = useMemo(() => {
    const occupiedCount = enrichedTables.filter((t) => t.effectiveStatus === 'OCUPADA').length;
    const reservedCount = enrichedTables.filter((t) => t.effectiveStatus === 'RESERVADA').length;
    const availableCount = enrichedTables.filter((t) => t.effectiveStatus === 'LIBRE').length;
    const totalCount = enrichedTables.length;
    return { occupiedCount, reservedCount, availableCount, totalCount };
  }, [enrichedTables]);

  // Filtro de mesas
  const filteredTables = useMemo(() => {
    return enrichedTables.filter((t) => {
      const matchesStatus =
        tableFilter === 'TODAS' ||
        (tableFilter === 'LIBRES' && t.effectiveStatus === 'LIBRE') ||
        (tableFilter === 'OCUPADAS' && t.effectiveStatus === 'OCUPADA') ||
        (tableFilter === 'RESERVADAS' && t.effectiveStatus === 'RESERVADA');

      const matchesZone = zoneFilter === 'TODAS' || t.zoneId === zoneFilter || t.zoneName === zoneFilter;

      return matchesStatus && matchesZone;
    });
  }, [enrichedTables, tableFilter, zoneFilter]);

  // Active orders count for KPI delta / operational metrics
  const activeOrders = useMemo(() => {
    return orders.filter((o) =>
      ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
    );
  }, [orders]);

  const activeOrdersCount = activeOrders.length;

  // Pedidos demorados / overdue (N20)
  const overdueOrders = useMemo(() => {
    const now = Date.now();
    return activeOrders.filter((o) => {
      if (o.overdue === true) return true;
      if (!o.createdAt) return false;
      return computeOrderOverdue(
        {
          status: o.status as any,
          createdAt: o.createdAt,
          estimatedMinutes: o.estimatedMinutes,
          delayMinutes: o.delayMinutes,
        },
        now,
        estimatedPrepMinutes
      );
    });
  }, [activeOrders, estimatedPrepMinutes]);

  // Cambiar modo de operación
  const handleToggleOperatingMode = async () => {
    const newMode: OperatingMode = operatingMode === 'hybrid' ? 'waiter_only' : 'hybrid';
    setOperatingMode(newMode);
    try {
      setSavingSettings(true);
      await updateTenantSettings({ operatingMode: newMode });
      showToast(
        newMode === 'hybrid'
          ? 'Modo Híbrido activado (QR + Meseros)'
          : 'Modo Solo Meseros activado (QR inactivo)'
      );
    } catch (err: any) {
      showToast(err?.message || 'Error al actualizar modo de operación');
      setOperatingMode(operatingMode);
    } finally {
      setSavingSettings(false);
    }
  };

  // Cambiar SLA
  const handleSlaChange = (newVal: number) => {
    setEstimatedPrepMinutes(newVal);
  };

  const handleSlaCommit = async (newVal: number) => {
    if (newVal === lastPersistedSlaRef.current) return;
    try {
      await updateTenantSettings({ estimatedPrepMinutes: newVal });
      lastPersistedSlaRef.current = newVal;
      showToast(`Tiempo SLA actualizado a ${newVal} min`);
    } catch (err: any) {
      showToast(err?.message || 'Error al actualizar SLA');
    }
  };

  // Acciones de mesa
  const handleOcuparMesa = async (tableId: string, label: string) => {
    try {
      await staffOpenTableSession(tableId);
      showToast(`Mesa ${label} ocupada correctamente`);
      await loadAllData();
    } catch (err: any) {
      showToast(err?.message || 'Error al ocupar mesa');
    }
  };

  const handleClienteLlego = async (tableId: string, label: string) => {
    try {
      const res = activeReservationsToday.find((r) => r.tableId === tableId);
      if (res) {
        await seatReservation(res.id);
        showToast(`Cliente llegó: Mesa ${label} ocupada`);
      } else {
        await staffOpenTableSession(tableId);
        showToast(`Mesa ${label} ocupada`);
      }
      await loadAllData();
    } catch (err: any) {
      showToast(err?.message || 'Error al sentar cliente');
    }
  };

  const handleCancelarReserva = async (tableId: string) => {
    try {
      const res = activeReservationsToday.find((r) => r.tableId === tableId);
      if (res) {
        await cancelReservation(res.id);
        showToast('Reserva cancelada');
        await loadAllData();
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cancelar reserva');
    }
  };

  const handleCobrarMesa = (tableId?: string) => {
    if (tableId) {
      router.push('/checkout?tableId=' + tableId);
    } else {
      router.push('/checkout');
    }
  };

  // CRUD Mesas
  const handleOpenCreateTable = () => {
    setNewTableLabel('');
    setNewTableCapacity(4);
    setNewTableZoneId(zones[0]?.id || '');
    setCreateTableError(null);
    setShowCreateTableModal(true);
  };

  const handleSubmitCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) {
      setCreateTableError('Ingresa un número o nombre para la mesa');
      return;
    }
    setSubmittingTable(true);
    setCreateTableError(null);
    try {
      await createTable({
        label: newTableLabel.trim(),
        capacity: Number(newTableCapacity) || 4,
        zoneId: newTableZoneId || undefined,
        status: 'AVAILABLE',
      });
      setShowCreateTableModal(false);
      showToast(`Mesa ${newTableLabel.trim()} creada`);
      await loadAllData();
    } catch (err: any) {
      setCreateTableError(err?.message || 'Error al crear la mesa');
    } finally {
      setSubmittingTable(false);
    }
  };

  const handleOpenEditTable = (t: TableDTO) => {
    setEditingTable(t);
    setEditTableLabel(t.label);
    setEditTableCapacity(t.capacity || 4);
    setEditTableZoneId(t.zoneId || '');
    setEditTableStatus(t.status || 'AVAILABLE');
    setEditTableError(null);
  };

  const handleSubmitEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setSubmittingEditTable(true);
    setEditTableError(null);
    try {
      await updateTable(editingTable.tableId, {
        label: editTableLabel.trim(),
        capacity: Number(editTableCapacity) || 4,
        zoneId: editTableZoneId || undefined,
        status: editTableStatus,
      });
      setEditingTable(null);
      showToast(`Mesa ${editTableLabel} actualizada`);
      await loadAllData();
    } catch (err: any) {
      setEditTableError(err?.message || 'Error al actualizar mesa');
    } finally {
      setSubmittingEditTable(false);
    }
  };

  const handleConfirmDeleteTable = async () => {
    if (!deletingTable) return;
    setSubmittingDelete(true);
    setDeleteTableError(null);
    try {
      await deleteTable(deletingTable.tableId);
      setDeletingTable(null);
      showToast(`Mesa ${deletingTable.label} eliminada`);
      await loadAllData();
    } catch (err: any) {
      setDeleteTableError(err?.message || 'Error al eliminar mesa');
    } finally {
      setSubmittingDelete(false);
    }
  };

  // QR
  const handleViewQr = async (table: TableDTO) => {
    setActiveTableQr(table);
    setQrData(null);
    setQrError(null);
    setQrLoading(true);
    try {
      const res = await fetchTableQr(table.tableId);
      setQrData(res);
    } catch (err: any) {
      setQrError(err?.message || 'Error al cargar el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRotateQrCode = async (table: TableDTO) => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await rotateTableQr(table.tableId);
      setQrData(res);
      showToast('Código QR rotado correctamente');
    } catch (err: any) {
      setQrError(err?.message || 'Error al rotar código QR');
    } finally {
      setQrLoading(false);
    }
  };

  // CRUD Zonas
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    setSubmittingZone(true);
    setZoneActionError(null);
    try {
      await createZone({ name: newZoneName.trim(), sortOrder: Number(newZoneSortOrder) || 0 });
      setNewZoneName('');
      setNewZoneSortOrder(0);
      showToast('Zona creada');
      await loadAllData();
    } catch (err: any) {
      setZoneActionError(err?.message || 'Error al crear zona');
    } finally {
      setSubmittingZone(false);
    }
  };

  const handleUpdateZone = async (zoneId: string) => {
    if (!editZoneName.trim()) return;
    setSubmittingZone(true);
    setZoneActionError(null);
    try {
      await updateZone(zoneId, { name: editZoneName.trim() });
      setEditingZoneId(null);
      showToast('Zona actualizada');
      await loadAllData();
    } catch (err: any) {
      setZoneActionError(err?.message || 'Error al actualizar zona');
    } finally {
      setSubmittingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    setSubmittingZone(true);
    setZoneActionError(null);
    try {
      await deleteZone(zoneId);
      showToast('Zona eliminada');
      await loadAllData();
    } catch (err: any) {
      setZoneActionError(err?.message || 'Error al eliminar zona');
    } finally {
      setSubmittingZone(false);
    }
  };

  // Modal Reserva
  const handleOpenReservation = (tableId?: string) => {
    setResTableId(tableId || (tables[0]?.tableId ?? ''));
    setResCustomerName('');
    setResPhone('');
    setResPartySize(2);
    setResTime('19:30');
    setResNotes('');
    setReservationError(null);
    setShowReservationModal(true);
  };

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCustomerName.trim() || !resTableId) {
      setReservationError('Nombre del cliente y mesa son requeridos');
      return;
    }
    setSubmittingReservation(true);
    setReservationError(null);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const reservedFor = `${todayIso}T${resTime}:00Z`;

      await createReservation({
        tableId: resTableId,
        customerName: resCustomerName.trim(),
        phone: resPhone.trim(),
        partySize: Number(resPartySize) || 2,
        reservedFor,
        notes: resNotes.trim() || undefined,
      });

      setShowReservationModal(false);
      showToast(`Reserva confirmada para ${resCustomerName}`);
      await loadAllData();
    } catch (err: any) {
      setReservationError(err?.message || 'Error al crear la reserva');
    } finally {
      setSubmittingReservation(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
          <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
          <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
        </div>
        <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px' }}>
          <Skeleton height="28px" width="180px" style={{ marginBottom: '16px' }} />
          <Skeleton height="180px" />
        </BentoCard>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Error al cargar dashboard"
        message={error}
        onRetry={loadAllData}
        retryLabel="Reintentar"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Toast flotante */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: 'var(--bento-overlay-dark)',
            color: 'var(--bento-card-bg-solid)',
            padding: '10px 24px',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 400,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Cabecera de Resumen con Toggle de Modo de Operación */}
      <section
        aria-label="Cabecera y modo de operación"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 300,
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Resumen Operativo
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
            Estado de mesas en vivo, métricas de atención y reservas del día
          </p>
        </div>

        {/* Toggle de Modo de Operación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-muted)', textTransform: 'uppercase' }}>
            Modo de Operación:
          </span>
          <button
            type="button"
            data-testid="operating-mode-toggle"
            aria-label="Toggle Modo de Operación"
            onClick={handleToggleOperatingMode}
            disabled={savingSettings}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: savingSettings ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid',
              backgroundColor: operatingMode === 'hybrid' ? 'rgba(255, 255, 255, 0.9)' : 'var(--bento-primary)',
              borderColor: operatingMode === 'hybrid' ? 'var(--bento-border)' : 'var(--bento-primary)',
              color: operatingMode === 'hybrid' ? 'var(--bento-text)' : 'var(--bento-card-bg-solid)',
              boxShadow: 'var(--bento-card-shadow)',
              minHeight: '40px',
            }}
          >
            {operatingMode === 'hybrid' ? 'Híbrido (QR + Meseros)' : 'Solo Meseros (QR Inactivo)'}
          </button>
        </div>
      </section>

      {/* 1. Resumen Operativo: 3 tarjetas métricas superiores */}
      <section aria-label="Indicadores clave de rendimiento">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {/* Tarjeta 1: Mesas Ocupadas */}
          <BentoCard
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '6px',
                height: '100%',
                backgroundColor: 'var(--bento-status-occupied)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--bento-text-muted)' }}>
                  Mesas Ocupadas
                </p>
              </div>
              <span
                style={{
                  backgroundColor: 'rgba(224, 166, 166, 0.25)',
                  color: 'var(--bento-danger-text)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Activas
              </span>
            </div>
            {/* KPI Delta compatible */}
            <div style={{ marginTop: '8px' }}>
              <KpiDelta
                label="Mesas Activas"
                value={String(metrics.occupiedCount)}
                delta={metrics.occupiedCount > 0 ? `${metrics.occupiedCount} en sala` : 'sin mesas'}
                trend={metrics.occupiedCount > 0 ? 'up' : 'neutral'}
                context={`de ${metrics.totalCount} mesas configuradas`}
              />
            </div>
          </BentoCard>

          {/* Tarjeta 2: Mesas Libres y Reservadas (Disponibilidad) */}
          <BentoCard
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '6px',
                height: '100%',
                backgroundColor: 'var(--bento-status-available)',
              }}
            />
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--bento-text-muted)' }}>
              Disponibilidad
            </p>
            <div style={{ display: 'flex', gap: '24px', margin: '8px 0' }}>
              <div>
                <span style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--bento-status-available-text)' }}>
                  {metrics.availableCount} Libres
                </span>
              </div>
              <div>
                <span style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--bento-status-reserved-soft-text)' }}>
                  {metrics.reservedCount} Reservas
                </span>
              </div>
            </div>
            {/* KPI Delta compatible para pedidos activos */}
            <KpiDelta
              label="Pedidos Activos"
              value={String(activeOrdersCount)}
              delta={activeOrdersCount > 0 ? `${activeOrdersCount} en curso` : 'al día'}
              trend={activeOrdersCount > 0 ? 'up' : 'neutral'}
              context="en preparación y sala"
            />
          </BentoCard>

          {/* Tarjeta 3: Tiempo Límite Estimado (SLA) interactivo */}
          <BentoCard
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--bento-text-muted)' }}>
                  Tiempo Límite Estimado
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.6875rem', color: 'var(--bento-text-muted)' }}>
                  Umbral de aviso en cocina y SLA
                </p>
              </div>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid var(--bento-border)',
                  color: 'var(--bento-text)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                {estimatedPrepMinutes} min
              </span>
            </div>

            <div style={{ margin: '16px 0 8px 0' }}>
              <input
                type="range"
                min={5}
                max={120}
                value={estimatedPrepMinutes}
                aria-label="Tiempo Límite Estimado (SLA)"
                onChange={(e) => handleSlaChange(Number(e.target.value))}
                onMouseUp={(e) => handleSlaCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSlaCommit(Number((e.target as HTMLInputElement).value))}
                onBlur={(e) => handleSlaCommit(Number((e.target as HTMLInputElement).value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--bento-primary)',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--bento-text-muted)' }}>
                <span>5m</span>
                <span>60m</span>
                <span>120m</span>
              </div>
            </div>
          </BentoCard>

          {/* Tarjeta 4: Pedidos Demorados (N20) */}
          <BentoCard
            data-testid="overdue-orders-card"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '6px',
                height: '100%',
                backgroundColor: overdueOrders.length > 0 ? 'var(--bento-status-occupied)' : 'var(--bento-status-available)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--bento-text-muted)' }}>
                  Pedidos demorados
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.6875rem', color: 'var(--bento-text-muted)' }}>
                  Exceden el SLA de cocina ({estimatedPrepMinutes}m)
                </p>
              </div>
              <span
                style={{
                  backgroundColor: overdueOrders.length > 0 ? 'rgba(224, 166, 166, 0.25)' : 'rgba(166, 224, 186, 0.25)',
                  color: overdueOrders.length > 0 ? 'var(--bento-danger-text)' : 'var(--bento-status-available-text)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {overdueOrders.length}
              </span>
            </div>

            <div style={{ marginTop: '12px' }}>
              {overdueOrders.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                  Todos los pedidos marchan a tiempo.
                </div>
              ) : (
                <ul
                  data-testid="overdue-orders-list"
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {overdueOrders.map((o) => {
                    const elapsed = o.createdAt
                      ? Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000))
                      : 0;
                    const tableDisplay = getTableDisplayName(o.tableId, tables);
                    return (
                      <li
                        key={o.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--bento-text)' }}>
                          {tableDisplay} • {formatOrderNumber(o.id)}
                        </span>
                        <span style={{ color: 'var(--bento-danger-text)', fontWeight: 600 }}>
                          +{elapsed}m
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </BentoCard>
        </div>

        {/* FeatureGuard opcional para analíticas */}
        <FeatureGuard
          flag="analytics"
          fallback={null}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginTop: '24px' }}>
            <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px', minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Proximamente featureName="Ventas del Día" />
            </BentoCard>
            <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)', padding: '24px', minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Proximamente featureName="Ticket Promedio" />
            </BentoCard>
          </div>
        </FeatureGuard>
      </section>

      {/* 2. Plano de Mesas con Filtros y CRUD */}
      <section aria-label="Plano de mesas">
        <BentoCard style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-heading)',
                  color: 'var(--bento-text)',
                }}
              >
                Plano de Mesas
              </h2>

              {/* Filtro por Zona */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="zone-filter-select" style={{ fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                  Zona:
                </label>
                <select
                  id="zone-filter-select"
                  aria-label="Filtrar por Zona"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.8125rem',
                    color: 'var(--bento-text)',
                    outline: 'none',
                  }}
                >
                  <option value="TODAS">Todas las Zonas</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Filtro de Estado TabsPill */}
              <TabsPill
                tabs={[
                  { id: 'TODAS', label: 'TODAS' },
                  { id: 'LIBRES', label: 'LIBRES' },
                  { id: 'OCUPADAS', label: 'OCUPADAS' },
                  { id: 'RESERVADAS', label: 'RESERVADAS' },
                ]}
                value={tableFilter}
                onChange={(val) => setTableFilter(val as any)}
                ariaLabel="Filtrar mesas por estado"
              />

              {/* Botón Gestión Zonas */}
              <button
                type="button"
                onClick={() => setShowZonesModal(true)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  color: 'var(--bento-text)',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                Zonas
              </button>

              {/* Botón Nueva Mesa */}
              <button
                type="button"
                onClick={handleOpenCreateTable}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--bento-card-shadow)',
                  minHeight: '36px',
                }}
              >
                + Nueva Mesa
              </button>
            </div>
          </div>

          {/* Grid de Mesas */}
          {filteredTables.length === 0 ? (
            <EmptyState
              title="No hay mesas en este filtro"
              description="Cambia el filtro de estado o zona para ver más mesas, o crea una nueva mesa."
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredTables.map((t) => {
                const statusDotColor =
                  t.effectiveStatus === 'LIBRE'
                    ? 'var(--bento-status-available)'
                    : t.effectiveStatus === 'OCUPADA'
                    ? 'var(--bento-status-occupied)'
                    : t.effectiveStatus === 'RESERVADA'
                    ? 'var(--bento-status-reserved)'
                    : 'var(--bento-status-disabled)';

                const statusLabel =
                  t.effectiveStatus === 'LIBRE'
                    ? 'Libre'
                    : t.effectiveStatus === 'OCUPADA'
                    ? 'Ocupada'
                    : t.effectiveStatus === 'RESERVADA'
                    ? 'Reservada'
                    : 'Deshabilitada';

                const chipTone =
                  t.effectiveStatus === 'LIBRE'
                    ? ('ok' as const)
                    : t.effectiveStatus === 'OCUPADA'
                    ? ('error' as const)
                    : t.effectiveStatus === 'RESERVADA'
                    ? ('warning' as const)
                    : ('neutral' as const);

                const tableTitle = t.label.toLowerCase().startsWith('mesa') ? t.label : `Mesa ${t.label}`;

                return (
                  <div
                    key={t.tableId}
                    data-testid={`table-card-${t.tableId}`}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.75)',
                      borderRadius: 'var(--bento-card-radius)',
                      padding: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.9)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '160px',
                    }}
                  >
                    <div>
                      {/* Cabecera tarjeta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--bento-text)' }}>
                          {tableTitle}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: statusDotColor,
                              boxShadow: '0 0 4px rgba(0,0,0,0.1)',
                            }}
                          />
                          <StatusChip label={statusLabel} tone={chipTone} />
                        </div>
                      </div>

                      {/* Subtítulo: N Puestos • Zona */}
                      <p style={{ margin: '4px 0 8px 0', fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                        {t.capacity} Puestos • {t.zoneName}
                      </p>

                      {/* Consumo si está ocupada */}
                      {t.effectiveStatus === 'OCUPADA' && (
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--bento-text)' }}>
                          {formatCOP(t.currentBillCop)}
                        </p>
                      )}
                    </div>

                    {/* Acciones por estado */}
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {t.effectiveStatus === 'LIBRE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOcuparMesa(t.tableId, t.label)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                color: 'var(--bento-text)',
                                border: '1px solid var(--bento-border)',
                                borderRadius: 'var(--bento-inner-radius)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Ocupar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReservation(t.tableId)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                backgroundColor: 'rgba(220, 201, 138, 0.25)',
                                color: 'var(--bento-status-reserved-text)',
                                border: '1px solid rgba(220, 201, 138, 0.5)',
                                borderRadius: 'var(--bento-inner-radius)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Reservar
                            </button>
                          </>
                        )}

                        {t.effectiveStatus === 'OCUPADA' && (
                          <button
                            type="button"
                            onClick={() => handleCobrarMesa(t.tableId)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: 'var(--bento-primary)',
                              color: 'var(--bento-card-bg-solid)',
                              border: 'none',
                              borderRadius: 'var(--bento-inner-radius)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Cobrar y liberar
                          </button>
                        )}

                        {t.effectiveStatus === 'RESERVADA' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleClienteLlego(t.tableId, t.label)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                color: 'var(--bento-text)',
                                border: '1px solid var(--bento-border)',
                                borderRadius: 'var(--bento-inner-radius)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Cliente Llegó
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelarReserva(t.tableId)}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                backgroundColor: 'rgba(255,255,255,0.7)',
                                color: 'var(--bento-text-muted)',
                                border: '1px solid var(--bento-border)',
                                borderRadius: 'var(--bento-inner-radius)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>

                      {/* Acciones de gestión secundaria (Ver QR / Editar / Eliminar) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleViewQr(t)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.6875rem',
                            color: 'var(--bento-text)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Ver QR
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditTable(t)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.6875rem',
                            color: 'var(--bento-text-muted)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTable(t)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.6875rem',
                            color: 'var(--bento-danger-text)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </section>

      {/* 3. Lista de Reservas del Día */}
      <section aria-label="Reservas del día">
        <BentoCard style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-heading)',
                  color: 'var(--bento-text)',
                }}
              >
                Reservas del Día
              </h2>
              <span
                style={{
                  backgroundColor: 'rgba(220, 201, 138, 0.3)',
                  color: 'var(--bento-status-reserved-text)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {activeReservationsToday.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenReservation()}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Nueva Reserva
            </button>
          </div>

          {activeReservationsToday.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
              No hay reservas programadas para el día de hoy.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeReservationsToday.map((res) => {
                const tableMatch = tables.find((t) => t.tableId === res.tableId);
                const tableLabel = tableMatch?.label ? `Mesa ${tableMatch.label}` : `Mesa ${res.tableId}`;

                let timeStr = 'Hoy';
                try {
                  const d = new Date(res.reservedFor);
                  timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch {
                  timeStr = res.reservedFor;
                }

                return (
                  <div
                    key={res.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      borderRadius: 'var(--bento-inner-radius)',
                      border: '1px solid var(--bento-border)',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--bento-text)' }}>
                          {res.customerName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                          • {res.phone}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            backgroundColor: 'rgba(92, 103, 132, 0.1)',
                            color: 'var(--bento-primary)',
                            borderRadius: '4px',
                          }}
                        >
                          {tableLabel}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                        {res.partySize} personas • {timeStr}
                        {res.notes ? ` • Nota: ${res.notes}` : ''}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleClienteLlego(res.tableId, tableMatch?.label || res.tableId)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: 'var(--bento-text)',
                          border: '1px solid var(--bento-border)',
                          borderRadius: 'var(--bento-pill-radius)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cliente Llegó
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelarReserva(res.tableId)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          color: 'var(--bento-danger-text)',
                          border: '1px solid rgba(160, 90, 90, 0.3)',
                          borderRadius: 'var(--bento-pill-radius)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </section>

      {/* 4. Brief Operativo y Alertas (asistencia y llamadas) */}
      <section aria-label="Brief operativo y alertas">
        <BentoCard style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Brief Operativo & Alertas
            </h2>
            {serviceCalls.length > 0 && (
              <StatusChip tone="warning" label={`${serviceCalls.length} pendientes`} />
            )}
          </div>

          {serviceCalls.length === 0 ? (
            <EmptyState
              title="Sin alertas activas"
              description="Servicio al día. No hay llamadas de mesero ni solicitudes pendientes."
            />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {serviceCalls.map((call) => {
                const tableMatch = tables.find((t) => (t.tableId || (t as any).id) === call.tableId);
                const tableLabel = tableMatch?.label ? `Mesa ${tableMatch.label}` : `Mesa ${call.tableId}`;

                return (
                  <li
                    key={call.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--bento-inner-radius)',
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid var(--bento-border)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--bento-text)' }}>
                        {tableLabel}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--bento-text-muted)' }}>
                        {call.note || 'Solicitud de asistencia'}
                      </span>
                    </div>
                    <StatusChip tone="warning" label="Pendiente" />
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </section>

      {/* MODAL: Crear Mesa */}
      {showCreateTableModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-table-title"
          ref={createTableModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateTableModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '420px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            <h3 id="modal-create-table-title" style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 300, color: 'var(--bento-text-strong)' }}>
              Nueva Mesa
            </h3>

            {createTableError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {createTableError}
              </div>
            )}

            <form onSubmit={handleSubmitCreateTable} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="create-table-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Nombre o Identificador de Mesa
                </label>
                <input
                  id="create-table-label"
                  type="text"
                  placeholder="Ej. 1, 10 o Terraza 2"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="create-table-capacity" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Capacidad (Puestos)
                </label>
                <input
                  id="create-table-capacity"
                  type="number"
                  min={1}
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="create-table-zone" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Zona
                </label>
                <select
                  id="create-table-zone"
                  value={newTableZoneId}
                  onChange={(e) => setNewTableZoneId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="">(Sin zona asignada)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateTableModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    color: 'var(--bento-text-secondary)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingTable}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: submittingTable ? 'wait' : 'pointer',
                  }}
                >
                  Guardar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Mesa */}
      {editingTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-table-title"
          ref={editTableModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTable(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '420px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            <h3 id="modal-edit-table-title" style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 300, color: 'var(--bento-text-strong)' }}>
              Editar Mesa {editingTable.label}
            </h3>

            {editTableError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {editTableError}
              </div>
            )}

            <form onSubmit={handleSubmitEditTable} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="edit-table-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Nombre o Identificador
                </label>
                <input
                  id="edit-table-label"
                  type="text"
                  value={editTableLabel}
                  onChange={(e) => setEditTableLabel(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="edit-table-capacity" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Capacidad (Puestos)
                </label>
                <input
                  id="edit-table-capacity"
                  type="number"
                  min={1}
                  value={editTableCapacity}
                  onChange={(e) => setEditTableCapacity(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="edit-table-zone" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Zona
                </label>
                <select
                  id="edit-table-zone"
                  value={editTableZoneId}
                  onChange={(e) => setEditTableZoneId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="">(Sin zona asignada)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-table-status" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Estado de la Mesa
                </label>
                <select
                  id="edit-table-status"
                  value={editTableStatus}
                  onChange={(e) => setEditTableStatus(e.target.value as TableStatus)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="AVAILABLE">Habilitada (Disponible)</option>
                  <option value="DISABLED">Deshabilitada</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    color: 'var(--bento-text-secondary)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEditTable}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: submittingEditTable ? 'wait' : 'pointer',
                  }}
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Eliminar Mesa Confirmación */}
      {deletingTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-table-title"
          ref={deleteTableModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingTable(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '400px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            <h3 id="modal-delete-table-title" style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 400, color: 'var(--bento-text-strong)' }}>
              ¿Eliminar Mesa {deletingTable.label}?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--bento-text-secondary)' }}>
              Esta acción no se puede deshacer. Las mesas con sesión activa no pueden eliminarse.
            </p>

            {deleteTableError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {deleteTableError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeletingTable(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  color: 'var(--bento-text-secondary)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTable}
                disabled={submittingDelete}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bento-danger-text)',
                  color: 'var(--bento-card-bg-solid)',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: submittingDelete ? 'wait' : 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ver QR */}
      {activeTableQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-qr-title"
          ref={qrModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTableQr(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '400px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
              textAlign: 'center',
            }}
          >
            <h3 id="modal-qr-title" style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 300, color: 'var(--bento-text-strong)' }}>
              QR Mesa {activeTableQr.label}
            </h3>

            {qrError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {qrError}
              </div>
            )}

            {qrLoading ? (
              <div style={{ padding: '24px' }}>
                <Skeleton height="160px" width="160px" style={{ margin: '0 auto' }} />
              </div>
            ) : qrData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <img
                  src={qrData.pngDataUrl}
                  alt={`QR Mesa ${activeTableQr.label}`}
                  style={{ width: '180px', height: '180px', borderRadius: '12px', border: '1px solid var(--bento-card-bg-solid)' }}
                />
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bento-text-secondary)', wordBreak: 'break-all' }}>
                  {qrData.url}
                </p>
                <button
                  type="button"
                  onClick={() => handleRotateQrCode(activeTableQr)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--bento-pill-radius)',
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: '1px solid var(--bento-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '8px',
                  }}
                >
                  Rotar QR
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setActiveTableQr(null)}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.6)',
                color: 'var(--bento-text-secondary)',
                border: '1px solid rgba(255,255,255,0.8)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Gestionar Zonas */}
      {showZonesModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-zones-title"
          ref={zonesModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowZonesModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 id="modal-zones-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 300, color: 'var(--bento-text-strong)' }}>
                Gestión de Zonas
              </h3>
              <button
                type="button"
                onClick={() => setShowZonesModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--bento-text-secondary)' }}
              >
                ✕
              </button>
            </div>

            {zoneActionError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {zoneActionError}
              </div>
            )}

            {/* Crear nueva zona */}
            <form onSubmit={handleCreateZone} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Nombre de la zona (ej. Terraza)"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                required
                style={{
                  flex: 2,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--bento-card-bg-solid)',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
              <input
                type="number"
                placeholder="Orden"
                value={newZoneSortOrder}
                onChange={(e) => setNewZoneSortOrder(Number(e.target.value))}
                style={{
                  width: '60px',
                  padding: '8px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--bento-card-bg-solid)',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={submittingZone}
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: submittingZone ? 'wait' : 'pointer',
                }}
              >
                Agregar
              </button>
            </form>

            {/* Lista de zonas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {zones.map((z) => {
                const isEditing = editingZoneId === z.id;
                const assignedCount = tables.filter((t) => t.zoneId === z.id).length;

                return (
                  <div
                    key={z.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(255,255,255,0.65)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.8)',
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                        <input
                          type="text"
                          value={editZoneName}
                          onChange={(e) => setEditZoneName(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--bento-primary)',
                            fontSize: '0.8125rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateZone(z.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'var(--bento-primary)',
                            color: 'var(--bento-card-bg-solid)',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingZoneId(null)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            color: 'var(--bento-text-secondary)',
                            border: 'none',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--bento-text-strong)' }}>
                            {z.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)', marginLeft: '8px' }}>
                            ({assignedCount} mesas)
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingZoneId(z.id);
                              setEditZoneName(z.name);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '0.75rem',
                              color: 'var(--bento-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteZone(z.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '0.75rem',
                              color: 'var(--bento-danger-text)',
                              cursor: 'pointer',
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Reserva */}
      {showReservationModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reservation-title"
          ref={reservationModalRef}
          tabIndex={-1}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReservationModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-panel-bg)',
              borderRadius: '2rem',
              width: '100%',
              maxWidth: '420px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.7)',
            }}
          >
            <h3 id="modal-reservation-title" style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 300, color: 'var(--bento-text-strong)' }}>
              Nueva Reserva
            </h3>

            {reservationError && (
              <div role="alert" style={{ color: 'var(--bento-danger-text)', fontSize: '0.8125rem', marginBottom: '12px' }}>
                {reservationError}
              </div>
            )}

            <form onSubmit={handleSubmitReservation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="res-table-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Mesa
                </label>
                <select
                  id="res-table-select"
                  value={resTableId}
                  onChange={(e) => setResTableId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  {tables.map((t) => (
                    <option key={t.tableId} value={t.tableId}>
                      Mesa {t.label} ({t.capacity || 4} puestos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="res-customer-name" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Nombre del Cliente
                </label>
                <input
                  id="res-customer-name"
                  type="text"
                  placeholder="Ej. Carolina Gómez"
                  value={resCustomerName}
                  onChange={(e) => setResCustomerName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="res-phone" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                    Teléfono
                  </label>
                  <input
                    id="res-phone"
                    type="text"
                    placeholder="310 123 4567"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--bento-card-bg-solid)',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ width: '90px' }}>
                  <label htmlFor="res-party-size" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                    Personas
                  </label>
                  <input
                    id="res-party-size"
                    type="number"
                    min={1}
                    value={resPartySize}
                    onChange={(e) => setResPartySize(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--bento-card-bg-solid)',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="res-time" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Hora de Llegada
                </label>
                <input
                  id="res-time"
                  type="time"
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="res-notes" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}>
                  Notas u Ocasión (Opcional)
                </label>
                <input
                  id="res-notes"
                  type="text"
                  placeholder="Ej. Aniversario, mesa tranquila"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bento-card-bg-solid)',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowReservationModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    color: 'var(--bento-text-secondary)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReservation}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: submittingReservation ? 'wait' : 'pointer',
                  }}
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
