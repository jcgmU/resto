import React from 'react';
import {
  OrderDTO,
  OrderStatus,
  OrderHistoryEventDTO,
  TableDTO,
} from '@packages/shared-types';
import { KdsColumn } from './KdsColumn';

export interface KdsBoardProps {
  orders: OrderDTO[];
  tables?: TableDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
  tenantSlaMinutes?: number;
  onUpdateDelay?: (orderId: string, delayMinutes: number) => void;
  onFetchHistory?: (orderId: string) => Promise<OrderHistoryEventDTO[]>;
  monitorKind?: 'kitchen' | 'bar' | null;
}

export function KdsBoard({
  orders,
  tables,
  onAdvanceStatus,
  updatingOrderId,
  tenantSlaMinutes = 18,
  onUpdateDelay,
  onFetchHistory,
  monitorKind,
}: KdsBoardProps) {
  // Filtrar primero por destino si monitorKind está presente
  const destinationOrders = monitorKind
    ? orders.filter((o) => (o.items || []).some((i) => (i.destination || 'kitchen') === monitorKind))
    : orders;

  // Solo mostramos órdenes en estados activos para este monitor
  const activeOrders = destinationOrders.filter((o) => {
    const effStatus = monitorKind === 'kitchen'
      ? (o.kitchenStatus || o.status)
      : monitorKind === 'bar'
      ? (o.barStatus || o.status)
      : o.status;
    return ['PLACED', 'IN_KITCHEN', 'READY'].includes(effStatus);
  });

  return (
    <div
      data-testid="kds-board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        width: '100%',
        alignItems: 'start',
      }}
    >
      <KdsColumn
        status="PLACED"
        title="Nuevos en fila"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
        tenantSlaMinutes={tenantSlaMinutes}
        onUpdateDelay={onUpdateDelay}
        onFetchHistory={onFetchHistory}
        monitorKind={monitorKind}
      />
      <KdsColumn
        status="IN_KITCHEN"
        title="En preparación"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
        tenantSlaMinutes={tenantSlaMinutes}
        onUpdateDelay={onUpdateDelay}
        onFetchHistory={onFetchHistory}
        monitorKind={monitorKind}
      />
      <KdsColumn
        status="READY"
        title="Listos"
        orders={activeOrders}
        tables={tables}
        onAdvanceStatus={onAdvanceStatus}
        updatingOrderId={updatingOrderId}
        tenantSlaMinutes={tenantSlaMinutes}
        onUpdateDelay={onUpdateDelay}
        onFetchHistory={onFetchHistory}
        monitorKind={monitorKind}
      />
    </div>
  );
}
