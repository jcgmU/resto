"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { FeatureGuard } from '@packages/ui-components';
import {
  StatusChip,
  Skeleton,
  ErrorState,
  Toast,
  getTableDisplayName,
} from '@packages/ui-components';
import {
  OrderDTO,
  ServiceCallDTO,
  OrderStatus,
  TableDTO,
  OrderHistoryEventDTO,
} from '@packages/shared-types';
import { KdsBoard, ServiceCallPanel, KdsLiveAnnouncer } from '../../../components/kds';
import * as realtime from '../../../lib/realtime';
import { ApiClient, getValidAccessToken } from '../../../lib/api';
import {
  fetchOrders,
  fetchServiceCalls,
  updateOrderStatus,
  updateOrderDelay,
  fetchOrderHistory,
  resolveServiceCall,
} from '../../../lib/api/kds';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export default function KdsPage() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [calls, setCalls] = useState<ServiceCallDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const tablesRef = React.useRef<TableDTO[]>(tables);
  tablesRef.current = tables;
  const [tenantSla, setTenantSla] = useState<number>(18);
  const [announcement, setAnnouncement] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carga / sincronización de snapshot de cocina
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, callsRes, tablesRes, settingsRes] = await Promise.allSettled([
        fetchOrders(),
        fetchServiceCalls(),
        ApiClient.request('/v1/tables'),
        ApiClient.request('/v1/tenant/settings'),
      ]);

      // 1. Pedidos (ordering)
      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value;
        if (Array.isArray(data)) {
          setOrders(data);
          setOrdersError(null);
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          setLastUpdated(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
        }
      } else {
        const err = ordersRes.reason;
        setOrdersError(err?.message || 'Error al conectar con el servicio de cocina');
      }

      // 2. Llamadas de servicio
      if (callsRes.status === 'fulfilled') {
        const data = callsRes.value;
        if (Array.isArray(data)) {
          setCalls(data);
          setCallsError(null);
        }
      } else {
        const err = callsRes.reason;
        setCallsError(err?.message || 'Error al conectar con las llamadas de servicio');
      }

      // 3. Mesas
      if (tablesRes.status === 'fulfilled') {
        const data = tablesRes.value?.data || tablesRes.value;
        if (Array.isArray(data)) {
          setTables(data);
        }
      }

      // 4. Configuración SLA del tenant (default 18)
      if (settingsRes.status === 'fulfilled') {
        const settings = settingsRes.value?.data || settingsRes.value;
        if (settings && typeof settings.estimatedPrepMinutes === 'number') {
          setTenantSla(settings.estimatedPrepMinutes);
        }
      }
    } catch (err: any) {
      setOrdersError(err?.message || 'Error al conectar con el servicio de cocina');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInitialData = fetchData;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hook realtime socket when mounted (if token exists)
  useEffect(() => {
    let isMounted = true;
    const token =
      ApiClient.token ||
      (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    // Refrescar token llamando a getValidAccessToken() de ../../lib/api al conectar
    getValidAccessToken()
      .then((fresh) => {
        if (fresh && (socket as any)?.auth) {
          (socket as any).auth.token = fresh;
        }
      })
      .catch(() => {});

    const socket = realtime.connectOrdersSocket(token);

    socket.on('connect', async () => {
      if (!isMounted) return;
      setConnectionStatus('connected');
      // En reconexión: refrescar token y volver a solicitar snapshot completo (fetchData)
      try {
        const freshToken = await getValidAccessToken();
        if (freshToken && (socket as any)?.auth) {
          (socket as any).auth.token = freshToken;
        }
      } catch {}
      await fetchData();
    });

    socket.on('connect_error', async () => {
      if (!isMounted) return;
      setConnectionStatus('reconnecting');
      try {
        const freshToken = await getValidAccessToken();
        if (freshToken && (socket as any)?.auth) {
          (socket as any).auth.token = freshToken;
        }
      } catch {}
    });

    socket.on('disconnect', () => {
      if (!isMounted) return;
      setConnectionStatus('disconnected');
    });

    socket.on('order:created', (data: { order: OrderDTO }) => {
      if (!isMounted) return;
      setOrders((prev) => {
        if (prev.some((o) => o.id === data.order.id)) return prev;
        return [...prev, data.order];
      });
      setAnnouncement(`Nueva orden de la mesa ${getTableDisplayName(data.order.tableId, tablesRef.current)}`);
    });

    socket.on('order:status-changed', (data: { order: OrderDTO; status: OrderStatus }) => {
      if (!isMounted) return;
      setOrders((prev) =>
        prev.map((o) => (o.id === data.order.id ? data.order : o))
      );
      if (data.status === 'READY') {
        setAnnouncement(`Orden de la mesa ${getTableDisplayName(data.order.tableId, tablesRef.current)} lista`);
      }
    });

    socket.on('service-call:created', (data: { call: ServiceCallDTO }) => {
      if (!isMounted) return;
      setCalls((prev) => [...prev, data.call]);
      setAnnouncement(`Llamado de servicio en la mesa ${getTableDisplayName(data.call.tableId, tablesRef.current)}`);
    });

    socket.on('service-call:resolved', (data: { call: ServiceCallDTO }) => {
      if (!isMounted) return;
      setCalls((prev) => prev.filter((c) => c.callId !== data.call.callId));
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [fetchData]);

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    if (!currentOrder) return;
    const previousStatus = currentOrder.status;

    // Actualización optimista del estado local
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    setUpdatingOrderId(orderId);

    try {
      const updated = await updateOrderStatus(orderId, nextStatus);
      if (updated && updated.id) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch (err: any) {
      // Reversa optimista en caso de fallo del backend
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o))
      );
      setToastMessage(err?.message || 'Error al actualizar el estado del pedido');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdateDelay = async (orderId: string, delayMinutes: number) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    if (!currentOrder) return;
    const previousDelay = currentOrder.delayMinutes;

    // Actualización optimista del delay
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, delayMinutes } : o))
    );

    try {
      const updated = await updateOrderDelay(orderId, delayMinutes);
      if (updated && updated.id) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch (err: any) {
      // Reversa optimista
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, delayMinutes: previousDelay } : o))
      );
      setToastMessage(err?.message || 'Error al asignar la demora del pedido');
    }
  };

  const handleFetchHistory = async (orderId: string): Promise<OrderHistoryEventDTO[]> => {
    return await fetchOrderHistory(orderId);
  };

  const handleResolveCall = async (callId: string) => {
    const currentCall = calls.find((c) => c.callId === callId);
    if (!currentCall) return;

    // Actualización optimista retirando la llamada
    setCalls((prev) => prev.filter((c) => c.callId !== callId));

    try {
      await resolveServiceCall(callId);
    } catch (err: any) {
      // Reversa optimista restaurando la llamada
      setCalls((prev) => {
        if (prev.some((c) => c.callId === callId)) return prev;
        return [...prev, currentCall];
      });
      setToastMessage(err?.message || 'Error al resolver la llamada de servicio');
    }
  };

  const connectionChip =
    ordersError ? (
      <StatusChip label="Desconectado" tone="error" />
    ) : connectionStatus === 'connected' ? (
      <StatusChip label="En vivo" tone="ok" />
    ) : connectionStatus === 'reconnecting' ? (
      <StatusChip label="Desconectado - Reconectando..." tone="error" />
    ) : connectionStatus === 'connecting' ? (
      <StatusChip label="Conectando..." tone="warning" />
    ) : (
      <StatusChip label="Desconectado" tone="error" />
    );

  return (
    <FeatureGuard flag="kitchen-display">
      <div
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '1600px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <KdsLiveAnnouncer message={announcement} />

        {/* Encabezado KDS con estado en vivo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--bento-text)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              Pantalla de Cocina
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: 'var(--bento-text-muted)',
              }}
            >
              Monitor operativo de pedidos y llamadas de sala
            </p>
            {lastUpdated && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '12px',
                  color: 'var(--bento-text-muted)',
                }}
              >
                Última actualización: {lastUpdated}
              </span>
            )}
          </div>
          <div>{connectionChip}</div>
        </div>

        {ordersError && orders.length === 0 ? (
          <ErrorState
            title="Error al conectar con el servicio de cocina"
            message={ordersError}
            onRetry={fetchData}
            retryLabel="Reintentar"
          />
        ) : (
          <>
            {ordersError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: 'var(--bento-card-radius)',
                  border: '1px solid var(--bento-destructive)',
                  backgroundColor: 'var(--bento-card-bg-solid)',
                  color: 'var(--bento-destructive)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{ordersError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchData}
                  style={{
                    background: 'none',
                    border: '1px solid var(--bento-destructive)',
                    color: 'var(--bento-destructive)',
                    padding: '4px 10px',
                    borderRadius: 'var(--bento-card-radius)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Reintentar
                </button>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '24px',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
            <div style={{ flex: '1 1 680px', minWidth: '300px' }}>
              {isLoading && orders.length === 0 ? (
                <div style={{ marginBottom: '16px' }}>
                  <Skeleton height="80px" radius="var(--bento-card-radius)" />
                </div>
              ) : null}
              <KdsBoard
                orders={orders}
                tables={tables}
                onAdvanceStatus={handleAdvanceStatus}
                updatingOrderId={updatingOrderId}
                tenantSlaMinutes={tenantSla}
                onUpdateDelay={handleUpdateDelay}
                onFetchHistory={handleFetchHistory}
              />
            </div>
            <div style={{ width: '320px', flexShrink: 0 }}>
              {callsError && (
                <div
                  role="alert"
                  style={{
                    padding: '10px 14px',
                    marginBottom: '12px',
                    borderRadius: 'var(--bento-card-radius)',
                    border: '1px solid var(--bento-destructive)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-destructive)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{callsError}</span>
                </div>
              )}
              <ServiceCallPanel calls={calls} tables={tables} onResolve={handleResolveCall} />
            </div>
          </div>
        </>
        )}

        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
            }}
          >
            <Toast
              message={toastMessage}
              onDismiss={() => setToastMessage(null)}
              duration={4000}
            />
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
