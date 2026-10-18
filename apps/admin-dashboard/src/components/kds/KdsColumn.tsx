import React from 'react';
import {
  OrderDTO,
  OrderStatus,
  OrderHistoryEventDTO,
  TableDTO,
} from '@packages/shared-types';
import { KdsOrderCard } from './KdsOrderCard';

export interface KdsColumnProps {
  status: OrderStatus;
  title: string;
  orders: OrderDTO[];
  tables?: TableDTO[];
  onAdvanceStatus?: (orderId: string, nextStatus: OrderStatus) => void;
  updatingOrderId?: string | null;
  tenantSlaMinutes?: number;
  onUpdateDelay?: (orderId: string, delayMinutes: number) => void;
  onFetchHistory?: (orderId: string) => Promise<OrderHistoryEventDTO[]>;
}

export function KdsColumn({
  status,
  title,
  orders,
  tables,
  onAdvanceStatus,
  updatingOrderId,
  tenantSlaMinutes,
  onUpdateDelay,
  onFetchHistory,
}: KdsColumnProps) {
  // Ordenadas siempre por más tiempo transcurrido primero (createdAt asc)
  const columnOrders = orders
    .filter((o) => o.status === status)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });

  const countText = `${columnOrders.length} orden${columnOrders.length === 1 ? '' : 'es'}`;

  return (
    <div
      data-testid={`kds-column-${status.toLowerCase()}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--bento-card-radius)',
        border: '1px solid var(--bento-border)',
        backgroundColor: 'var(--bento-card-bg)',
        padding: '16px',
        boxShadow: 'var(--bento-card-shadow)',
        minHeight: '400px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--bento-border)',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.05em',
            color: 'var(--bento-text)',
            textTransform: 'uppercase',
            fontFamily: 'var(--bento-font-heading)',
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--bento-text-muted)',
            backgroundColor: 'var(--bento-page-bg)',
            padding: '2px 10px',
            borderRadius: 'var(--bento-pill-radius)',
            border: '1px solid var(--bento-border)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {countText}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
        }}
      >
        {columnOrders.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--bento-text-muted)',
              fontSize: '14px',
              border: '1px dashed var(--bento-border)',
              borderRadius: 'var(--bento-inner-radius)',
            }}
          >
            Sin órdenes
          </div>
        ) : (
          columnOrders.map((order) => (
            <KdsOrderCard
              key={order.id}
              order={order}
              tables={tables}
              onAdvanceStatus={onAdvanceStatus}
              isUpdating={updatingOrderId === order.id}
              tenantSlaMinutes={tenantSlaMinutes}
              onUpdateDelay={onUpdateDelay}
              onFetchHistory={onFetchHistory}
            />
          ))
        )}
      </div>
    </div>
  );
}
