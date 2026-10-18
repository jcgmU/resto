import React, { useState } from 'react';
import {
  BentoCard,
  KpiValue,
  ORDER_STATUS_LABELS,
  formatOrderNumber,
  getTableDisplayName,
} from '@packages/ui-components';
import {
  OrderDTO,
  OrderStatus,
  ORDER_STATUS_TRANSITIONS,
  OrderHistoryEventDTO,
  TableDTO,
  computeOrderOverdue,
  computeEffectiveSlaMinutes,
} from '@packages/shared-types';
import { fetchOrderHistory, updateOrderDelay } from '../../lib/api/kds';

export interface KdsOrderCardProps {
  order: OrderDTO;
  tables?: TableDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  isUpdating?: boolean;
  alertMinutes?: number;
  tenantSlaMinutes?: number;
  onUpdateDelay?: (orderId: string, delayMinutes: number) => void;
  onFetchHistory?: (orderId: string) => Promise<OrderHistoryEventDTO[]>;
}

export function KdsOrderCard({
  order,
  tables,
  onAdvanceStatus,
  isUpdating = false,
  alertMinutes = 15,
  tenantSlaMinutes,
  onUpdateDelay,
  onFetchHistory,
}: KdsOrderCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<OrderHistoryEventDTO[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isUpdatingDelay, setIsUpdatingDelay] = useState(false);

  const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status] || [];
  const nextStatus = allowedTransitions.find((s) => s !== 'CANCELLED');

  const createdAtTime = new Date(order.createdAt).getTime();
  const now = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtTime) / 60000));

  // SLA efectivo: estimatedMinutes + delayMinutes (usando función compartida de shared-types)
  const baseTenantSla = tenantSlaMinutes ?? alertMinutes ?? 18;
  const effectiveSLA = computeEffectiveSlaMinutes(order, baseTenantSla);

  const ratio = effectiveSLA > 0 ? elapsedMinutes / effectiveSLA : 1;
  const isOverdue =
    order.overdue === true ||
    computeOrderOverdue(order, now, baseTenantSla) ||
    ratio >= 1;
  const isWarning = ratio >= 0.75 && !isOverdue;

  // Colores dinámicos SLA (REF-2): Verde (< 75%), Ámbar (>= 75% y < 100%), Rojo (>= 100% o overdue)
  const slaColor = isOverdue
    ? 'var(--bento-status-occupied)'
    : isWarning
    ? 'var(--bento-status-reserved)'
    : 'var(--bento-status-available)';
  const slaTone = isOverdue ? 'destructive' : isWarning ? 'warning' : 'ok';
  const slaColorName = isOverdue ? 'red' : isWarning ? 'amber' : 'green';

  const handleDelayClick = async (extraMinutes: number) => {
    const currentDelay = order.delayMinutes || 0;
    const nextDelay = currentDelay + extraMinutes;
    if (onUpdateDelay) {
      onUpdateDelay(order.id, nextDelay);
      return;
    }
    setIsUpdatingDelay(true);
    try {
      await updateOrderDelay(order.id, nextDelay);
    } catch {
      // Manejado externamente o silent fallback
    } finally {
      setIsUpdatingDelay(false);
    }
  };

  const handleToggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const events = onFetchHistory
        ? await onFetchHistory(order.id)
        : await fetchOrderHistory(order.id);
      setHistoryEvents(events || []);
    } catch (err: any) {
      setHistoryError(err?.message || 'Error al cargar historial');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <BentoCard
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      {/* Barra de Progreso SLA (REF-2) */}
      <div
        data-testid="sla-bar-track"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          data-testid="sla-bar"
          data-sla-tone={slaTone}
          data-sla-color={slaColorName}
          style={{
            height: '100%',
            width: `${Math.min(100, Math.round(ratio * 100))}%`,
            backgroundColor: slaColor,
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: '16px',
                color: 'var(--bento-text)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              {getTableDisplayName(order.tableId, tables)}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--bento-text-muted)' }}>
              {formatOrderNumber(order.id)}
            </span>
          </div>

          {/* Contador visible SLA: elapsedMinutes m / effectiveSLA m (REF-2, N20) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              data-testid="sla-counter"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isOverdue ? 'var(--bento-status-occupied-text)' : isWarning ? 'var(--bento-status-reserved-text)' : 'var(--bento-text)',
                backgroundColor: isOverdue ? 'var(--bento-note-item-bg)' : isWarning ? 'var(--bento-note-general-bg)' : 'rgba(255, 255, 255, 0.8)',
                padding: '2px 8px',
                borderRadius: 'var(--bento-pill-radius, 9999px)',
                border: '1px solid var(--bento-border)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {elapsedMinutes}m / {effectiveSLA}m
            </span>
            <KpiValue
              label="Tiempo"
              value={`${elapsedMinutes}m`}
              tone={isOverdue ? 'destructive' : 'neutral'}
            />
          </div>
        </div>

        {/* Ítems del pedido */}
        <div
          style={{
            borderTop: '1px solid var(--bento-border)',
            paddingTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {order.items.map((item) => (
            <div key={item.id} style={{ fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>
                  {item.quantity}x {item.productName}
                </span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--bento-text-muted)', paddingLeft: '16px' }}>
                  {item.modifiers.map((m) => m.optionName).join(', ')}
                </div>
              )}
              {/* Notas por ítem con estilo Suite (REF-4, N01): fondo rojo pastel var(--bento-note-item-bg), texto var(--bento-status-occupied-text) */}
              {item.notes && (
                <div
                  data-testid="item-notes"
                  data-note-type="item"
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: 'var(--bento-note-item-bg)',
                    color: 'var(--bento-status-occupied-text)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    marginTop: '4px',
                    border: '1px solid var(--bento-note-item-border)',
                  }}
                >
                  Nota: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Notas generales de la orden (REF-4, N01): fondo ámbar pastel var(--bento-note-general-bg), texto var(--bento-status-reserved-text) */}
        {order.notes && (
          <div
            data-testid="order-general-notes"
            data-note-type="general"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'var(--bento-note-general-bg)',
              color: 'var(--bento-status-reserved-text)',
              padding: '6px 10px',
              borderRadius: '8px',
              marginTop: '4px',
              border: '1px solid var(--bento-note-general-border)',
            }}
          >
            Nota general: {order.notes}
          </div>
        )}

        {/* Selector rápido de demora (N20): +5m, +10m, +15m */}
        <div
          data-testid="order-delay-control"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid var(--bento-border)',
            fontSize: '12px',
          }}
        >
          <span style={{ color: 'var(--bento-text-muted)', fontWeight: 600 }}>
            Demora: {order.delayMinutes ? `+${order.delayMinutes}m` : '0m'}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[5, 10, 15].map((extra) => (
              <button
                key={extra}
                type="button"
                data-testid={`delay-${extra}m`}
                aria-label={`Asignar +${extra}m de demora`}
                disabled={isUpdatingDelay}
                onClick={() => handleDelayClick(extra)}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-border)',
                  backgroundColor: 'var(--bento-card-bg-solid)',
                  color: 'var(--bento-primary)',
                  cursor: 'pointer',
                  minHeight: '28px',
                  minWidth: '36px',
                }}
              >
                +{extra}m
              </button>
            ))}
          </div>
        </div>

        {/* Historial / Línea de tiempo de orden (N13) */}
        <div>
          <button
            type="button"
            data-testid="toggle-history-btn"
            aria-expanded={showHistory}
            onClick={handleToggleHistory}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--bento-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 0',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial'}
          </button>

          {showHistory && (
            <div
              data-testid="order-history-panel"
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--bento-inner-radius, 12px)',
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                border: '1px solid var(--bento-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <strong style={{ fontSize: '12px', color: 'var(--bento-text)' }}>
                  Historial de estados
                </strong>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: 'var(--bento-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
              </div>

              {isLoadingHistory ? (
                <span style={{ fontSize: '11px', color: 'var(--bento-text-muted)' }}>
                  Cargando historial...
                </span>
              ) : historyError ? (
                <span style={{ fontSize: '11px', color: 'var(--bento-destructive)' }}>
                  {historyError}
                </span>
              ) : historyEvents.length === 0 ? (
                <span style={{ fontSize: '11px', color: 'var(--bento-text-muted)' }}>
                  Sin historial registrado
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {historyEvents.map((evt) => (
                    <div
                      key={evt.id}
                      data-testid="history-event-row"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        padding: '4px 6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {ORDER_STATUS_LABELS[evt.fromStatus] || evt.fromStatus} →{' '}
                        {ORDER_STATUS_LABELS[evt.toStatus] || evt.toStatus}
                      </span>
                      <span style={{ color: 'var(--bento-text-muted)', fontSize: '10px' }}>
                        {new Date(evt.occurredAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botón para avanzar estado */}
      {nextStatus && onAdvanceStatus && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--bento-border)' }}>
          <button
            type="button"
            aria-busy={isUpdating ? 'true' : 'false'}
            onClick={() => onAdvanceStatus(order.id, nextStatus)}
            style={{
              width: '100%',
              minHeight: '40px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--bento-pill-radius)',
              backgroundColor: 'var(--bento-primary)',
              color: 'var(--bento-card-bg-solid)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'var(--bento-font-body)',
              transition: 'opacity 0.2s ease',
              opacity: isUpdating ? 0.7 : 1,
            }}
          >
            <svg
              style={{ width: '14px', height: '14px' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            Avanzar a {ORDER_STATUS_LABELS[nextStatus] || nextStatus}
          </button>
        </div>
      )}
    </BentoCard>
  );
}
