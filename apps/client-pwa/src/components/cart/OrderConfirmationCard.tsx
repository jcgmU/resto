import React, { useEffect, useState } from 'react';
import { OrderDTO } from '@packages/shared-types';
import { BentoCard, ProgressNodes, StatusChip, ORDER_STATUS_LABELS, formatOrderNumber } from '@packages/ui-components';
import { PwaApiClient } from '../../lib/api';

export interface OrderConfirmationCardProps {
  order: OrderDTO;
  pollIntervalMs?: number;
  onOrderUpdate?: (order: OrderDTO) => void;
  onAddAnotherOrder?: () => void;
}

const PROGRESS_STEPS = ['Recibido', 'En cocina', 'Listo', 'Entregado'];

function mapOrderStatusToProgress(status: string): {
  current: number;
  problemSegment?: number;
  isTerminal: boolean;
  chipTone: 'ok' | 'warning' | 'error' | 'neutral';
  description: string;
} {
  switch (status) {
    case 'PLACED':
    case 'CONFIRMED':
      return {
        current: 0,
        problemSegment: undefined,
        isTerminal: false,
        chipTone: 'neutral',
        description: 'El personal ha recibido tu pedido',
      };
    case 'IN_KITCHEN':
      return {
        current: 1,
        problemSegment: undefined,
        isTerminal: false,
        chipTone: 'warning',
        description: 'Tu pedido se está preparando en la cocina',
      };
    case 'READY':
      return {
        current: 2,
        problemSegment: undefined,
        isTerminal: false,
        chipTone: 'ok',
        description: 'Tu pedido está listo para servir',
      };
    case 'DELIVERED':
      return {
        current: 3,
        problemSegment: undefined,
        isTerminal: true,
        chipTone: 'ok',
        description: 'Tu pedido ha sido entregado. ¡Buen provecho!',
      };
    case 'CANCELLED':
      return {
        current: 0,
        problemSegment: 0,
        isTerminal: true,
        chipTone: 'error',
        description: 'El pedido ha sido cancelado',
      };
    default:
      return {
        current: 0,
        problemSegment: undefined,
        isTerminal: false,
        chipTone: 'neutral',
        description: 'El personal ha recibido tu pedido',
      };
  }
}

export function OrderConfirmationCard({
  order,
  pollIntervalMs = 5000,
  onOrderUpdate,
  onAddAnotherOrder,
}: OrderConfirmationCardProps) {
  const [currentOrder, setCurrentOrder] = useState<OrderDTO>(order);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  const statusInfo = mapOrderStatusToProgress(currentOrder.status);

  // Polling silencioso cada ~5s a getOrder(order.id), deteniéndose en estados terminales
  useEffect(() => {
    if (!currentOrder?.id) return;
    if (statusInfo.isTerminal) return;

    const intervalId = setInterval(async () => {
      try {
        const updated = await PwaApiClient.getOrder(currentOrder.id);
        if (updated) {
          setCurrentOrder(updated);
          onOrderUpdate?.(updated);
        }
      } catch {
        // Polling silencioso: ignorar errores transitorios de red
      }
    }, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentOrder.id, statusInfo.isTerminal, onOrderUpdate, pollIntervalMs]);

  return (
    <BentoCard
      style={{
        padding: 'var(--bento-spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--bento-spacing-md)',
        backgroundColor: 'var(--bento-card-bg-solid)',
        borderRadius: 'var(--bento-card-radius)',
        border: '1px solid var(--bento-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--bento-spacing-xs)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            fontFamily: 'var(--bento-font-heading, inherit)',
            color: 'var(--bento-text)',
          }}
        >
          {formatOrderNumber(currentOrder.id)}
        </h3>
        <StatusChip
          label={ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status}
          tone={statusInfo.chipTone}
        />
      </div>

      <div style={{ padding: 'var(--bento-spacing-xs) 0' }}>
        <ProgressNodes
          steps={PROGRESS_STEPS}
          current={statusInfo.current}
          problemSegment={statusInfo.problemSegment}
        />
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          color: 'var(--bento-text-muted)',
          fontFamily: 'var(--bento-font-body, inherit)',
        }}
      >
        {statusInfo.description}
      </p>

      {currentOrder.delayMinutes && currentOrder.delayMinutes > 0 ? (
        <div
          data-testid="order-delay-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--bento-inner-radius)',
            backgroundColor: 'var(--bento-status-reserved-bg)',
            border: '1px solid var(--bento-border)',
            color: 'var(--bento-text-strong)',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          <span>⏱</span>
          <span>Demora informada por cocina: +{currentOrder.delayMinutes} min</span>
        </div>
      ) : null}

      {/* Información de estado inmutable y opción de agregar más pedidos (U04) */}
      <div
        data-testid="order-clarity-actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--bento-spacing-xs)',
          paddingTop: 'var(--bento-spacing-xs)',
          borderTop: '1px solid var(--bento-border)',
        }}
      >
        <p
          data-testid="order-locked-notice"
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--bento-text-muted)',
            fontFamily: 'var(--bento-font-body, inherit)',
          }}
        >
          Pedido enviado; ya no puede editarse
        </p>

        <button
          type="button"
          onClick={onAddAnotherOrder}
          data-testid="add-another-order-btn"
          style={{
            alignSelf: 'flex-start',
            minHeight: 'var(--bento-touch-target, 44px)',
            padding: '0 var(--bento-spacing-md, 16px)',
            borderRadius: 'var(--bento-pill-radius)',
            backgroundColor: 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-border)',
            color: 'var(--bento-text)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--bento-font-body, inherit)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Agregar otro pedido
        </button>
      </div>

      {statusInfo.problemSegment !== undefined && (
        <div
          role="alert"
          style={{
            padding: 'var(--bento-spacing-xs) var(--bento-spacing-sm)',
            borderRadius: 'var(--bento-card-radius)',
            backgroundColor: 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-destructive)',
            color: 'var(--bento-destructive)',
            fontSize: '0.875rem',
            fontWeight: 600,
            textAlign: 'center',
            fontFamily: 'var(--bento-font-body, inherit)',
          }}
        >
          Pedido cancelado
        </div>
      )}
    </BentoCard>
  );
}
