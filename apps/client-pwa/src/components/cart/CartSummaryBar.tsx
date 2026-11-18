import { Button } from '@packages/ui-components';
import React from 'react';
import { KpiValue } from '@packages/ui-components';
import { useMoney } from '../../lib/money';

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
  const { format } = useMoney();
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
        value={format(total)}
        tone="accent"
      />

      <Button
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
        {isConfirming ? 'Enviando...' : `Enviar Pedido • ${format(total)}`}
      </Button>
    </div>
  );
}
