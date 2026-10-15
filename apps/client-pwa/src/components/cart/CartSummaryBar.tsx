import React from 'react';
import { KpiValue } from '@packages/ui-components';
import { formatCOP } from '@packages/shared-types';

export interface CartSummaryBarProps {
  total: number;
  onConfirm?: () => void;
  isConfirming?: boolean;
  disabled?: boolean;
}

export function CartSummaryBar({
  total,
  onConfirm,
  isConfirming,
  disabled,
}: CartSummaryBarProps) {
  return (
    <div
      data-component="cart-summary-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--bento-spacing-md)',
        borderTop: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
        backgroundColor: 'var(--bento-card-bg)',
      }}
    >
      <KpiValue
        label="Total"
        value={formatCOP(total)}
        tone="accent"
      />

      <button
        type="button"
        disabled={disabled || isConfirming}
        aria-busy={isConfirming}
        onClick={onConfirm}
        style={{
          minHeight: 'var(--bento-touch-target)',
          padding: '0 var(--bento-spacing-lg)',
          backgroundColor: 'var(--bento-accent-strong)',
          color: 'var(--bento-card-bg)',
          borderRadius: 'var(--bento-card-radius)',
          border: 'none',
          fontWeight: 700,
          cursor: disabled || isConfirming ? 'not-allowed' : 'pointer',
          opacity: disabled || isConfirming ? 0.6 : 1,
        }}
      >
        {isConfirming ? 'Enviando...' : `Enviar Pedido • ${formatCOP(total)}`}
      </button>
    </div>
  );
}
