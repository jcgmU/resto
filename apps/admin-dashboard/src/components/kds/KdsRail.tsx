import React, { useEffect, useState } from 'react';
import {
  OrderDTO,
  OrderItemDTO,
  OrderStatus,
  ORDER_STATUS_TRANSITIONS,
  TableDTO,
} from '@packages/shared-types';
import { computeSlaStatus, getTableDisplayName, StatusCard, tableDisplayName } from '@packages/ui-components';

type Destination = 'kitchen' | 'bar';

export interface RailTicket {
  order: OrderDTO;
  status: OrderStatus;
  items: OrderItemDTO[];
  late: boolean;
  createdMs: number;
}

export interface AllDayCount {
  name: string;
  quantity: number;
}

const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'IN_KITCHEN', 'READY'];
const PENDING_STATUSES: OrderStatus[] = ['PLACED', 'IN_KITCHEN'];

function effectiveStatus(order: OrderDTO, kind: Destination): OrderStatus {
  return (kind === 'kitchen' ? order.kitchenStatus : order.barStatus) || order.status;
}

export function buildRailTickets(
  orders: OrderDTO[],
  kind: Destination,
  tenantSlaMinutes: number,
  nowMs: number = Date.now()
): RailTicket[] {
  const tickets: RailTicket[] = [];
  for (const order of orders) {
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') continue;
    const items = (order.items || []).filter((i) => (i.destination || 'kitchen') === kind);
    if (items.length === 0) continue;
    const status = effectiveStatus(order, kind);
    if (!ACTIVE_STATUSES.includes(status)) continue;

    const sla = computeSlaStatus(
      order.createdAt,
      order.estimatedMinutes ?? tenantSlaMinutes,
      order.delayMinutes ?? 0,
      nowMs
    );
    tickets.push({
      order,
      status,
      items,
      late: status !== 'READY' && sla.tone === 'red',
      createdMs: new Date(order.createdAt).getTime(),
    });
  }
  return tickets.sort((a, b) => a.createdMs - b.createdMs);
}

export function countAllDay(tickets: RailTicket[]): AllDayCount[] {
  const totals = new Map<string, number>();
  for (const ticket of tickets) {
    if (!PENDING_STATUSES.includes(ticket.status)) continue;
    for (const item of ticket.items) {
      totals.set(item.productName, (totals.get(item.productName) || 0) + item.quantity);
    }
  }
  return Array.from(totals, ([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity);
}

function formatClock(createdMs: number): string {
  const d = new Date(createdMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nextStatusOf(status: OrderStatus): OrderStatus | undefined {
  return ORDER_STATUS_TRANSITIONS[status].find((s) => s !== 'CANCELLED');
}

const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  IN_KITCHEN: 'Avanzar: en preparación',
  READY: 'Avanzar: listo',
  DELIVERED: 'Avanzar: entregado',
};

export interface KdsRailProps {
  orders: OrderDTO[];
  tables?: TableDTO[];
  monitorKind: Destination;
  tenantSlaMinutes?: number;
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
  now?: number;
}

export function KdsRail({
  orders,
  tables,
  monitorKind,
  tenantSlaMinutes = 18,
  onAdvanceStatus,
  updatingOrderId,
  now,
}: KdsRailProps) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [now]);
  const currentTime = now ?? clock;
  const tickets = buildRailTickets(orders, monitorKind, tenantSlaMinutes, currentTime);
  const allDay = countAllDay(tickets);

  const tableName = (tableId: string) => {
    const found = tables?.find((t) => t.tableId === tableId);
    return found?.label ? tableDisplayName(found.label) : getTableDisplayName(tableId, tables);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <section aria-label="Riel de tickets">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--bento-text-strong)' }}>El riel</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
            Lo más antiguo a la izquierda. Avanza el ticket cuando el plato sale.
          </span>
        </div>

        {tickets.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-panel-bg)',
              color: 'var(--bento-text-muted)',
            }}
          >
            Sin tickets en el riel
          </div>
        ) : (
          <div
            data-testid="kds-rail"
            style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'stretch' }}
          >
            {tickets.map((ticket) => {
              const next = nextStatusOf(ticket.status);
              const busy = updatingOrderId === ticket.order.id;
              const elapsed = Math.max(0, (currentTime - ticket.createdMs) / 60000);
              const effectiveSla = (ticket.order.estimatedMinutes ?? tenantSlaMinutes) + (ticket.order.delayMinutes ?? 0);
              const ratio = effectiveSla > 0 ? elapsed / effectiveSla : 1;
              return (
                <StatusCard
                  key={ticket.order.id}
                  status={ticket.late ? 'occupied' : ratio >= 0.75 ? 'reserved' : 'available'}
                  variant="progress"
                  progress={ratio}
                  data-testid={`rail-ticket-${ticket.order.id}`}
                  data-late={ticket.late ? 'true' : 'false'}
                  style={{
                    flex: '0 0 260px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '16px',
                    borderRadius: 'var(--bento-card-radius)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    boxShadow: 'var(--bento-card-shadow)',
                  }}
                >
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '1.125rem', color: 'var(--bento-text-strong)' }}>
                      {tableName(ticket.order.tableId)}
                    </strong>
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: ticket.late ? 'var(--bento-destructive)' : 'var(--bento-text-muted)',
                      }}
                    >
                      {formatClock(ticket.createdMs)}
                    </span>
                  </header>

                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {ticket.items.map((item) => (
                      <li key={item.id} style={{ display: 'flex', gap: '10px', color: 'var(--bento-text)' }}>
                        <span style={{ fontWeight: 700, minWidth: '1.5rem' }}>{item.quantity}</span>
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{item.productName}</span>
                          {item.notes && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>{item.notes}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    {ticket.late ? (
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--bento-destructive)' }}>Tarde</span>
                    ) : (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                        {ticket.status === 'READY' ? 'Listo para salir' : ticket.status === 'IN_KITCHEN' ? 'En preparación' : 'Nuevo'}
                      </span>
                    )}
                    {next && onAdvanceStatus && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAdvanceStatus(ticket.order.id, next)}
                        aria-label={ADVANCE_LABELS[next] || 'Avanzar'}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 'var(--bento-inner-radius)',
                          border: 'none',
                          backgroundColor: 'var(--bento-primary)',
                          color: 'var(--bento-card-bg-solid)',
                          fontWeight: 600,
                          cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        Avanzar
                      </button>
                    )}
                  </footer>
                </StatusCard>
              );
            })}
          </div>
        )}
      </section>

      <section
        aria-label="Pendiente por plato"
        data-testid="kds-all-day"
        style={{
          padding: '16px',
          borderRadius: 'var(--bento-card-radius)',
          backgroundColor: 'var(--bento-panel-bg)',
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--bento-text-strong)' }}>Todo el día</h2>
        {allDay.length === 0 ? (
          <span style={{ color: 'var(--bento-text-muted)', fontSize: '0.875rem' }}>Nada pendiente por cocinar</span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {allDay.map((dish) => (
              <div
                key={dish.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--bento-inner-radius)',
                  backgroundColor: 'var(--bento-card-bg-solid)',
                  color: 'var(--bento-text)',
                }}
              >
                <span>{dish.name}</span>
                <strong data-testid={`all-day-qty-${dish.name}`}>×{dish.quantity}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
