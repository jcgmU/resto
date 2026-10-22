"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BentoCard,
  StatusChip,
  TabsPill,
  SlaDot,
} from '@packages/ui-components';
import { formatCOP, TableDTO, ZoneDTO, ServiceCallDTO, OrderDTO } from '@packages/shared-types';
import {
  fetchTables,
  fetchZones,
  fetchMenu,
  staffOpenSession,
  addWaiterCartItem,
  confirmWaiterOrder,
  getAuthenticatedStaffUser,
  WaiterCategory,
  WaiterProduct,
} from '../../../lib/api/waiter';
import { ApiClient } from '../../../lib/api';
import { connectOrdersSocket } from '../../../lib/realtime';

interface WaiterCartItem {
  tempId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

export default function TerminalMeseroPage() {
  const router = useRouter();

  // Datos base
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCallDTO[]>([]);
  const [categories, setCategories] = useState<WaiterCategory[]>([]);
  const [products, setProducts] = useState<WaiterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zona activa
  const [selectedZoneId, setSelectedZoneId] = useState<string>('ALL');

  // Toma de comanda / modal de pedido
  const [orderTargetTable, setOrderTargetTable] = useState<TableDTO | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<WaiterCartItem[]>([]);
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  // Cambio de mesa (R12)
  const [movingSession, setMovingSession] = useState<{
    sessionId: string;
    sourceTableId: string;
    sourceTableLabel: string;
  } | null>(null);
  const [targetMoveTableId, setTargetMoveTableId] = useState<string>('');
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Carga de datos
  const loadData = useCallback(async () => {
    try {
      const [
        tablesRes,
        zonesRes,
        sessionsRes,
        callsRes,
        ordersRes,
        menuRes,
      ] = await Promise.all([
        fetchTables().catch(() => []),
        fetchZones().catch(() => []),
        ApiClient.request('/v1/sessions?status=active').catch(() => []),
        ApiClient.request('/v1/service-calls?status=pending').catch(() => []),
        ApiClient.request('/v1/orders').catch(() => []),
        fetchMenu().catch(() => ({ categories: [], products: [] })),
      ]);

      const normalizedTables = Array.isArray(tablesRes) ? tablesRes : (tablesRes as any)?.data || [];
      const normalizedZones: ZoneDTO[] = Array.isArray(zonesRes) ? zonesRes : (zonesRes as any)?.data || [];
      const normalizedSessions = Array.isArray(sessionsRes) ? sessionsRes : (sessionsRes as any)?.data || [];
      const normalizedCalls: ServiceCallDTO[] = Array.isArray(callsRes) ? callsRes : (callsRes as any)?.data || [];
      const normalizedOrders = Array.isArray(ordersRes) ? ordersRes : (ordersRes as any)?.data || [];

      setTables(normalizedTables);
      setZones(normalizedZones);
      setActiveSessions(normalizedSessions);
      setServiceCalls(normalizedCalls);
      setOrders(normalizedOrders);
      setCategories(menuRes.categories || []);
      setProducts(menuRes.products || []);

      // Auto-selección de zona asignada al mesero (R6)
      try {
        const rawUser = typeof window !== 'undefined' ? localStorage.getItem('resto_user') : null;
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u.id) {
            const myZone = normalizedZones.find((z) => z.staffIds && z.staffIds.includes(u.id));
            if (myZone) {
              setSelectedZoneId((prev) => (prev === 'ALL' ? myZone.id : prev));
            }
          }
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Socket realtime
    const token = ApiClient.token;
    if (token) {
      const socket = connectOrdersSocket(token);
      socket.on('table:status-changed', () => loadData());
      socket.on('service-call:created', () => loadData());
      socket.on('service-call:resolved', () => loadData());
      socket.on('order:status-changed', () => loadData());
      socket.on('session:checkout-completed', () => loadData());

      return () => {
        socket.off('table:status-changed');
        socket.off('service-call:created');
        socket.off('service-call:resolved');
        socket.off('order:status-changed');
        socket.off('session:checkout-completed');
      };
    }
  }, [loadData]);

  // Resolver llamada de servicio
  const handleResolveCall = async (callId: string) => {
    try {
      await ApiClient.request(`/v1/service-calls/${callId}/resolve`, { method: 'PATCH' });
      setServiceCalls((prev) => prev.filter((c) => (c.callId || (c as any).id) !== callId));
    } catch {
      // ignore
    }
  };

  // Filtrado de mesas por zona
  const filteredTables = useMemo(() => {
    if (selectedZoneId === 'ALL') return tables;
    return tables.filter((t) => t.zoneId === selectedZoneId);
  }, [tables, selectedZoneId]);

  // Datos enriquecidos por mesa
  const enrichedTables = useMemo(() => {
    return filteredTables.map((t) => {
      const activeSession = activeSessions.find(
        (s) => (s.tableId === t.tableId || s.tableId === (t as any).id) && s.status === 'active'
      );
      const zoneObj = zones.find((z) => z.id === t.zoneId);
      const zoneName = zoneObj?.name || 'Salón';

      // Llamadas pendientes para esta mesa
      const pendingCall = serviceCalls.find(
        (c) => (c.tableId === t.tableId || c.tableId === (t as any).id) && c.status === 'pending'
      );

      // Calcular consumo acumulado
      let tableConsumption = 0;
      if (activeSession) {
        const sessionOrders = orders.filter(
          (o) => o.tableId === t.tableId || (o as any).sessionId === activeSession.sessionId
        );
        for (const o of sessionOrders) {
          tableConsumption += Number(o.total || (o as any).totalAmount || 0);
        }
      }

      let statusLabel = 'Libre';
      let statusTone: 'ok' | 'error' | 'warning' | 'neutral' = 'ok';

      if (pendingCall?.type === 'BILL_REQUEST') {
        statusLabel = 'Pidiendo Cuenta';
        statusTone = 'warning';
      } else if (pendingCall?.type === 'WAITER_CALL') {
        statusLabel = 'Llamando';
        statusTone = 'warning';
      } else if (activeSession) {
        statusLabel = 'Ocupada';
        statusTone = 'error';
      }

      return {
        ...t,
        zoneName,
        activeSession,
        pendingCall,
        tableConsumption,
        statusLabel,
        statusTone,
      };
    });
  }, [filteredTables, activeSessions, serviceCalls, zones, orders]);

  // Manejo de cambio de mesa (R12)
  const handleOpenMove = (t: any) => {
    if (!t.activeSession) return;
    setMovingSession({
      sessionId: t.activeSession.sessionId,
      sourceTableId: t.tableId,
      sourceTableLabel: t.label,
    });
    setTargetMoveTableId('');
    setMoveError(null);
  };

  const handleConfirmMove = async () => {
    if (!movingSession || !targetMoveTableId) return;
    setIsSubmittingMove(true);
    setMoveError(null);
    try {
      await ApiClient.request(`/v1/sessions/${movingSession.sessionId}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetTableId: targetMoveTableId }),
      });
      setMovingSession(null);
      setTargetMoveTableId('');
      await loadData();
    } catch (err: any) {
      setMoveError(err?.message || 'Error al cambiar de mesa');
    } finally {
      setIsSubmittingMove(false);
    }
  };

  const availableMoveTables = useMemo(() => {
    return tables.filter((t) => {
      const isOccupied = activeSessions.some(
        (s) =>
          (s.tableId === t.tableId || s.tableId === (t as any).id) &&
          (s.status === 'active' || s.status === 'billRequested')
      );
      const isCurrent = movingSession
        ? t.tableId === movingSession.sourceTableId || (t as any).id === movingSession.sourceTableId
        : false;
      const isDisabled = t.status === 'DISABLED' || t.status === 'inactive';
      return !isOccupied && !isCurrent && !isDisabled;
    });
  }, [tables, activeSessions, movingSession]);

  // Manejo de carrito para toma de comanda
  const handleStartOrder = (t: TableDTO) => {
    setOrderTargetTable(t);
    const session = activeSessions.find(
      (s) => (s.tableId === t.tableId || s.tableId === (t as any).id) && s.status === 'active'
    );
    setActiveSessionId(session?.sessionId || null);
    setCart([]);
    setGeneralNotes('');
    setOrderSuccessMessage(null);
  };

  const handleAddProduct = (prod: WaiterProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) => (i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          tempId: `item-${Date.now()}-${Math.random()}`,
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const handleConfirmOrder = async () => {
    if (!orderTargetTable || cart.length === 0) return;
    setIsSubmittingOrder(true);
    setError(null);
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const res = await staffOpenSession(orderTargetTable.tableId);
        const sessionObj = (res as any)?.session || res;
        sessionId = sessionObj?.sessionId || sessionObj?.id;
        setActiveSessionId(sessionId);
      }

      const realStaffUser = getAuthenticatedStaffUser();

      for (const item of cart) {
        await addWaiterCartItem(sessionId!, {
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          productName: item.name,
          unitPrice: item.price,
          addedBy: realStaffUser,
        });
      }

      await confirmWaiterOrder(sessionId!, {
        tableId: orderTargetTable.tableId,
        notes: generalNotes,
      });

      setOrderSuccessMessage(`¡Comanda enviada a cocina para Mesa ${orderTargetTable.label}!`);
      setTimeout(() => {
        setOrderTargetTable(null);
        setCart([]);
        loadData();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al enviar pedido a cocina');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        maxWidth: '768px',
        margin: '0 auto',
        width: '100%',
        padding: '1rem',
        boxSizing: 'border-box',
        gap: '1rem',
      }}
    >
      {/* 1. Alertas de Llamadas de Servicio en Tiempo Real */}
      {serviceCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {serviceCalls.map((call) => {
            const table = tables.find((t) => t.tableId === call.tableId || (t as any).id === call.tableId);
            const rawLabel = table?.label || call.tableId;
            const tableDisplay = rawLabel.toLowerCase().startsWith('mesa') ? rawLabel : `Mesa ${rawLabel}`;
            const isBill = call.type === 'BILL_REQUEST';
            const cId = call.callId || (call as any).id;

            return (
              <div
                key={cId}
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--bento-inner-radius)',
                  backgroundColor: isBill ? 'var(--bento-status-reserved-bg)' : 'var(--bento-card-bg-solid)',
                  border: '1px solid var(--bento-border)',
                  boxShadow: 'var(--bento-card-shadow)',
                  animation: 'pulse 2s infinite',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🛎</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--bento-text-strong)' }}>
                      {tableDisplay} {isBill ? 'está solicitando la cuenta' : 'solicita atención'}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                      {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isBill && (
                    <button
                      type="button"
                      data-testid="banner-cobrar-btn"
                      onClick={() => router.push(`/terminal-caja?tableId=${call.tableId}`)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'var(--bento-primary)',
                        color: 'var(--bento-card-bg-solid)',
                        border: 'none',
                        borderRadius: 'var(--bento-pill-radius)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cobrar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResolveCall(cId)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: 'rgba(0,0,0,0.06)',
                      color: 'var(--bento-text)',
                      border: 'none',
                      borderRadius: 'var(--bento-pill-radius)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Atender
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Modal / Drawer para Toma de Comanda */}
      {orderTargetTable && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              backgroundColor: 'var(--bento-page-bg)',
              borderTopLeftRadius: 'var(--bento-card-radius)',
              borderTopRightRadius: 'var(--bento-card-radius)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--bento-text-strong)' }}>
                  Tomar Pedido — Mesa {orderTargetTable.label}
                </h2>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                  Selecciona productos del menú
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderTargetTable(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--bento-text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            {orderSuccessMessage && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bento-status-available-bg)', color: 'var(--bento-status-available-text)', borderRadius: '8px' }}>
                {orderSuccessMessage}
              </div>
            )}

            {error && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bento-status-occupied-bg)', color: 'var(--bento-status-occupied-text)', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            {/* Categorías */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: 'none',
                  backgroundColor: selectedCategory === 'ALL' ? 'var(--bento-primary)' : 'rgba(255,255,255,0.7)',
                  color: selectedCategory === 'ALL' ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: 'var(--bento-pill-radius)',
                    border: 'none',
                    backgroundColor: selectedCategory === c.id ? 'var(--bento-primary)' : 'rgba(255,255,255,0.7)',
                    color: selectedCategory === c.id ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Catálogo de Productos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {products
                .filter((p) => selectedCategory === 'ALL' || p.categoryId === selectedCategory || p.category?.id === selectedCategory)
                .map((prod) => (
                  <div
                    key={prod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(255,255,255,0.6)',
                      borderRadius: '8px',
                      border: '1px solid var(--bento-border)',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{prod.name}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                        {formatCOP(prod.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddProduct(prod)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: 'var(--bento-primary)',
                        color: 'var(--bento-card-bg-solid)',
                        border: 'none',
                        borderRadius: 'var(--bento-pill-radius)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Agregar
                    </button>
                  </div>
                ))}
            </div>

            {/* Carrito Resumen */}
            {cart.length > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--bento-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Comanda actual ({cart.length})</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatCOP(cartTotal)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                  {cart.map((item) => (
                    <div key={item.tempId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatCOP(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Instrucciones generales de cocina (opcional)..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.375rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--bento-border)',
                    fontSize: '0.75rem',
                    boxSizing: 'border-box',
                    marginBottom: '0.5rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isSubmittingOrder}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: 'none',
                    borderRadius: 'var(--bento-inner-radius)',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: isSubmittingOrder ? 'wait' : 'pointer',
                  }}
                >
                  {isSubmittingOrder ? 'Enviando comanda...' : `Enviar a Cocina • ${formatCOP(cartTotal)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Selector de Zona */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setSelectedZoneId('ALL')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--bento-pill-radius)',
            border: 'none',
            backgroundColor: selectedZoneId === 'ALL' ? 'var(--bento-primary)' : 'rgba(255,255,255,0.7)',
            color: selectedZoneId === 'ALL' ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--bento-card-shadow)',
          }}
        >
          Todas las Zonas
        </button>
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => setSelectedZoneId(z.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--bento-pill-radius)',
              border: 'none',
              backgroundColor: selectedZoneId === z.id ? 'var(--bento-primary)' : 'rgba(255,255,255,0.7)',
              color: selectedZoneId === z.id ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--bento-card-shadow)',
            }}
          >
            {z.name}
          </button>
        ))}
      </div>

      {/* 4. Lista de Tarjetas de Mesa (Móvil First) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {enrichedTables.map((t) => (
          <BentoCard
            key={t.tableId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.65)',
              border: '1px solid var(--bento-border)',
              borderRadius: 'var(--bento-inner-radius)',
              boxShadow: 'var(--bento-card-shadow)',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--bento-text-strong)' }}>
                  Mesa {t.label}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                  {t.zoneName} • {t.capacity} puestos
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t.activeSession && (
                  <SlaDot
                    createdAt={t.activeSession.createdAt || new Date().toISOString()}
                    estimatedPrepMinutes={18}
                    size="10px"
                  />
                )}
                <StatusChip label={t.statusLabel} tone={t.statusTone} />
              </div>
            </div>

            {/* Consumo acumulado si está ocupada */}
            {t.activeSession ? (
              <div
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>Consumo activo:</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--bento-text-strong)' }}>
                  {formatCOP(t.tableConsumption)}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)', fontStyle: 'italic' }}>
                Mesa disponible para recibir clientes
              </div>
            )}

            {/* Acciones Rápidas */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleStartOrder(t)}
                style={{
                  flex: 1,
                  minWidth: '110px',
                  padding: '0.5rem',
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: 'none',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                {t.activeSession ? 'Tomar Pedido' : 'Abrir y Pedir'}
              </button>

              {t.activeSession && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenMove(t)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      color: 'var(--bento-text)',
                      border: '1px solid var(--bento-border)',
                      borderRadius: 'var(--bento-pill-radius)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/terminal-caja?tableId=${t.tableId}`)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      color: 'var(--bento-text)',
                      border: '1px solid var(--bento-border)',
                      borderRadius: 'var(--bento-pill-radius)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cobrar
                  </button>
                </>
              )}
            </div>
          </BentoCard>
        ))}
      </div>

      {/* Modal de Cambio de Mesa (R12) */}
      {movingSession && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-card-bg-solid)',
              borderRadius: 'var(--bento-card-radius)',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: 'var(--bento-card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--bento-text-strong)' }}>
                Cambiar Mesa {movingSession.sourceTableLabel}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                Selecciona la mesa libre a la cual trasladar la comanda y comensales.
              </p>
            </div>

            {moveError && (
              <div
                style={{
                  padding: '0.625rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--bento-status-occupied)',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                }}
              >
                {moveError}
              </div>
            )}

            {availableMoveTables.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--bento-text-muted)', fontStyle: 'italic' }}>
                No hay otras mesas libres disponibles en este momento.
              </p>
            ) : (
              <div>
                <label
                  htmlFor="target-table-select"
                  style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--bento-text-secondary)', marginBottom: '4px' }}
                >
                  Mesa de Destino
                </label>
                <select
                  id="target-table-select"
                  value={targetMoveTableId}
                  onChange={(e) => setTargetMoveTableId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    borderRadius: '8px',
                    border: '1px solid var(--bento-border)',
                    fontSize: '0.875rem',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Seleccionar mesa libre --</option>
                  {availableMoveTables.map((t) => {
                    const zoneObj = zones.find((z) => z.id === t.zoneId);
                    return (
                      <option key={t.tableId} value={t.tableId}>
                        Mesa {t.label} ({t.capacity || 4} puestos{zoneObj ? ` • ${zoneObj.name}` : ''})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setMovingSession(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--bento-text)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMove}
                disabled={!targetMoveTableId || isSubmittingMove}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: !targetMoveTableId || isSubmittingMove ? 'rgba(0,0,0,0.15)' : 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: 'none',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: !targetMoveTableId || isSubmittingMove ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmittingMove ? 'Cambiando...' : 'Confirmar Traslado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
