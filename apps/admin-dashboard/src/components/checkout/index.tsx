import React, { useState } from 'react';
import { BillDTO, PaymentMethod, TableSessionDTO, TableDTO, formatCOP } from '@packages/shared-types';
import {
  BentoCard,
  KpiValue,
  ModalConfirm,
  Skeleton,
  formatOrderNumber,
  getTableDisplayName,
  PAYMENT_METHOD_LABELS,
  shortId,
} from '@packages/ui-components';

export interface ActiveTablesGridProps {
  sessions: TableSessionDTO[];
  tables?: TableDTO[];
  onSelectSession?: (session: TableSessionDTO) => void;
  selectedSessionId?: string;
  loading?: boolean;
}

export function ActiveTablesGrid({
  sessions,
  tables,
  onSelectSession,
  selectedSessionId,
  loading = false,
}: ActiveTablesGridProps) {
  if (loading) {
    return (
      <div
        data-testid="checkout-skeleton"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--bento-grid-gap)',
        }}
      >
        {[1, 2, 3].map((i) => (
          <BentoCard
            key={i}
            style={{
              padding: '16px',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <Skeleton width="60%" height="24px" />
            <Skeleton width="40%" height="16px" />
          </BentoCard>
        ))}
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--bento-text-muted)' }}>
        No hay mesas activas
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--bento-grid-gap)',
      }}
    >
      {sessions.map((session) => {
        const isSelected = selectedSessionId === session.sessionId;
        const displayName = getTableDisplayName(session.tableId, tables);
        return (
          <BentoCard
            key={session.sessionId}
            interactive={Boolean(onSelectSession)}
            onClick={() => onSelectSession?.(session)}
            style={{
              padding: '16px',
              minHeight: '44px',
              border: isSelected
                ? '2px solid var(--bento-tinta)'
                : '1px solid var(--bento-border)',
              backgroundColor: isSelected
                ? 'var(--bento-hueso)'
                : 'var(--bento-card-bg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', fontFamily: 'var(--bento-font-heading)' }}>
                {displayName}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--bento-text-muted)',
                marginTop: '4px',
                fontFamily: 'var(--bento-font-body)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span>
                Abierta: {session.createdAt ? new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
              <span>
                Sesión #{shortId(session.sessionId)}
              </span>
            </div>
          </BentoCard>
        );
      })}
    </div>
  );
}

export interface BillSummaryCardProps {
  bill: BillDTO;
  tables?: TableDTO[];
  error?: string;
  onRetry?: () => void;
}

export function BillSummaryCard({ bill, tables, error, onRetry }: BillSummaryCardProps) {
  const activeOrders = (bill.orders || []).filter((o) => o.status !== 'CANCELLED');

  return (
    <BentoCard
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3
          style={{
            margin: 0,
            fontSize: '1.2rem',
            fontFamily: 'var(--bento-font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Cuenta — {getTableDisplayName(bill.tableId, tables)}
        </h3>
        <KpiValue label="Total a cobrar" value={formatCOP(bill.total)} tone="accent" />
      </div>

      {error && (
        <div
          role="alert"
          tabIndex={-1}
          style={{
            padding: '12px',
            borderRadius: 'var(--bento-inner-radius)',
            background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
            color: 'var(--bento-destructive)',
            border: '1px solid var(--bento-destructive)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontFamily: 'var(--bento-font-body)' }}>
              {error === 'SESSION_CLOSE_FAILED'
                ? 'Error al cerrar la sesión en el servidor'
                : error === 'BILL_EMPTY'
                ? 'La mesa no tiene pedidos registrados para cobrar'
                : error === 'SESSION_NOT_FOUND'
                ? 'La sesión no existe o ya fue cerrada'
                : error === 'BILL_NOT_FOUND'
                ? 'No se encontró cuenta para esta sesión'
                : error}
            </span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 16px',
                borderRadius: 'var(--bento-pill-radius)',
                background: 'var(--bento-destructive)',
                color: 'var(--bento-papel)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--bento-font-body)',
                fontWeight: 600,
              }}
            >
              {error === 'SESSION_CLOSE_FAILED' ? 'Reintentar cierre' : 'Reintentar'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeOrders.map((order) => (
          <div
            key={order.id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--bento-border)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--bento-text-muted)', marginBottom: '4px', fontFamily: 'var(--bento-font-body)' }}>
              {formatOrderNumber(order.id)} • Subtotal: {formatCOP(order.total)}
            </div>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                <div>
                  <span style={{ marginRight: '6px' }}>{item.quantity}x</span>
                  <span>{item.productName}</span>
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCOP(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </BentoCard>
  );
}

export interface PaymentMethodPickerProps {
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodPicker({
  selectedMethod,
  onSelect,
}: PaymentMethodPickerProps) {
  const options: { method: PaymentMethod; label: string }[] = [
    { method: 'CASH', label: PAYMENT_METHOD_LABELS.CASH || 'Efectivo' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Método de pago"
      style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      {options.map((opt) => {
        const isSelected = selectedMethod === opt.method;
        return (
          <button
            key={opt.method}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.method)}
            style={{
              minHeight: '44px',
              minWidth: '100px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: 'var(--bento-pill-radius)',
              border: isSelected
                ? '2px solid var(--bento-tinta)'
                : '1px solid var(--bento-border)',
              background: isSelected
                ? 'var(--bento-hueso)'
                : 'var(--bento-papel)',
              color: 'var(--bento-text)',
              cursor: 'pointer',
              fontFamily: 'var(--bento-font-body)',
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ConfirmPaymentButtonProps {
  disabled?: boolean;
  total?: number;
  method?: PaymentMethod | null;
  onConfirm: () => void;
}

export function ConfirmPaymentButton({
  disabled = false,
  total = 0,
  method = null,
  onConfirm,
}: ConfirmPaymentButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsConfirming(true)}
        style={{
          minHeight: '44px',
          minWidth: '44px',
          padding: '0 20px',
          borderRadius: 'var(--bento-pill-radius)',
          background: disabled
            ? 'var(--bento-border)'
            : 'var(--bento-tinta)',
          color: disabled
            ? 'var(--bento-text-muted)'
            : 'var(--bento-papel)',
          border: 'none',
          fontFamily: 'var(--bento-font-body)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        Registrar cobro
      </button>

      <ModalConfirm
        open={isConfirming}
        title="Confirmar cobro"
        current={{ label: 'Cuenta actual', value: formatCOP(total) }}
        proposed={{ label: 'Total a cobrar', value: formatCOP(total) }}
        impacts={[
          { label: 'Método', value: PAYMENT_METHOD_LABELS[method || 'CASH'] || 'Efectivo' },
        ]}
        approveLabel="Confirmar cobro"
        rejectLabel="Cancelar"
        onApprove={() => {
          setIsConfirming(false);
          onConfirm();
        }}
        onReject={() => setIsConfirming(false)}
        onClose={() => setIsConfirming(false)}
      />
    </>
  );
}

export interface PaymentSuccessCardProps {
  tableId: string;
  amount: number;
  method: PaymentMethod;
  tables?: TableDTO[];
}

export function PaymentSuccessCard({
  tableId,
  amount,
  method,
  tables,
}: PaymentSuccessCardProps) {
  return (
    <BentoCard
      style={{
        padding: '20px',
        border: '1px solid var(--bento-success)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--bento-success)' }}>
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: '1.2rem', fontFamily: 'var(--bento-font-heading)' }}>
          Cobro registrado. Mesa liberada.
        </span>
      </div>
      <div style={{ color: 'var(--bento-text-muted)', fontFamily: 'var(--bento-font-body)' }}>
        {getTableDisplayName(tableId, tables)} • Total: {formatCOP(amount)} • Medio: {PAYMENT_METHOD_LABELS[method] || method}
      </div>
    </BentoCard>
  );
}

export interface ReleaseTableModalProps {
  open: boolean;
  tableName: string;
  pendingAmount: number;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  onRetry?: () => void;
}

export function ReleaseTableModal({
  open,
  tableName,
  pendingAmount,
  loading = false,
  error = null,
  onConfirm,
  onClose,
  onRetry,
}: ReleaseTableModalProps) {
  if (!open) return null;

  const hasPending = pendingAmount > 0;

  return (
    <div
      data-testid="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'color-mix(in srgb, var(--bento-hueso) 70%, transparent)',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-table-dialog-title"
        data-component="modal-confirm"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !loading) {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bento-papel)',
          color: 'var(--bento-text)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-border)',
          boxShadow: 'var(--bento-card-shadow)',
          padding: '24px',
          fontFamily: 'var(--bento-font-body)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2
          id="release-table-dialog-title"
          style={{ margin: 0, fontSize: '20px', fontFamily: 'var(--bento-font-heading)' }}
        >
          Liberar mesa
        </h2>

        {hasPending ? (
          <div
            role="alert"
            tabIndex={-1}
            style={{
              padding: '14px',
              borderRadius: 'var(--bento-inner-radius)',
              background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Acción bloqueada</span>
            </div>
            <span style={{ fontSize: '0.9rem' }}>
              La mesa tiene un consumo pendiente de {formatCOP(pendingAmount)} sin cobrar. No es posible liberar la mesa hasta liquidar la cuenta.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0, color: 'var(--bento-text)' }}>
              La mesa <strong>{tableName}</strong> está al día y no tiene consumos pendientes.
            </p>
            <p style={{ margin: 0, color: 'var(--bento-text-muted)', fontSize: '0.9rem' }}>
              ¿Confirmas que deseas cerrar la sesión y liberar la mesa?
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--bento-border)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--bento-text-muted)' }}>Mesa</span>
            <span style={{ fontWeight: 600 }}>{tableName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: 'var(--bento-text-muted)' }}>Saldo pendiente</span>
            <span style={{ fontWeight: 700, color: hasPending ? 'var(--bento-destructive)' : 'var(--bento-success)' }}>
              {formatCOP(pendingAmount)}
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            tabIndex={-1}
            style={{
              padding: '12px',
              borderRadius: 'var(--bento-inner-radius)',
              background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <span>{error === 'SESSION_CLOSE_FAILED' ? 'Error al cerrar la sesión en el servidor' : error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  minHeight: '36px',
                  padding: '0 12px',
                  borderRadius: 'var(--bento-pill-radius)',
                  background: 'var(--bento-destructive)',
                  color: 'var(--bento-papel)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reintentar cierre
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: 'var(--bento-pill-radius)',
              fontFamily: 'var(--bento-font-body)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: 'var(--bento-destructive)',
              border: '1px solid transparent',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={hasPending || loading}
            onClick={hasPending ? undefined : onConfirm}
            title={hasPending ? 'Acción bloqueada: saldo pendiente sin cobrar' : 'Confirmar liberación'}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: 'var(--bento-pill-radius)',
              fontFamily: 'var(--bento-font-body)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (hasPending || loading) ? 'not-allowed' : 'pointer',
              background: hasPending ? 'var(--bento-border)' : 'var(--bento-tinta)',
              color: hasPending ? 'var(--bento-text-muted)' : 'var(--bento-papel)',
              border: 'none',
              opacity: hasPending ? 0.6 : 1,
            }}
          >
            {loading ? 'Liberando...' : 'Confirmar liberación'}
          </button>
        </div>
      </div>
    </div>
  );
}

