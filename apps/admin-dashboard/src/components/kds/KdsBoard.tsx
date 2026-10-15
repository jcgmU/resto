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
}

export function KdsBoard({
  orders,
  tables,
  onAdvanceStatus,
  updatingOrderId,
  tenantSlaMinutes = 18,
  onUpdateDelay,
  onFetchHistory,
}: KdsBoardProps) {
  // Solo mostramos órdenes en estados activos (DELIVERED y CANCELLED salen del board)
  const activeOrders = orders.filter((o) =>
    ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
  );

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
      />
    </div>
  );
}
