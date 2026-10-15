import React from 'react';
import { CartItemDTO, formatCOP } from '@packages/shared-types';
import { BentoCard, KpiValue } from '@packages/ui-components';
import { QuantityStepper } from './QuantityStepper';
import { AddedByBadge } from './AddedByBadge';

export interface CartLineItemProps {
  item: CartItemDTO;
  currentUserId?: string;
  onUpdateQuantity?: (quantity: number) => void;
  onRemove?: () => void;
}

export function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
}: CartLineItemProps) {
  const modifiersSummary = (item.modifiers || [])
    .map((m) => m.optionName)
    .join(', ');

  return (
    <BentoCard style={{ padding: 'var(--bento-spacing-md)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--bento-spacing-sm)',
        }}
      >
        <div>
          <h4 style={{ margin: 0, color: 'var(--bento-text)' }}>{item.productName}</h4>
          {modifiersSummary && (
            <p
              style={{
                margin: 'var(--bento-spacing-xs) 0 0 0',
                color: 'var(--bento-text-muted)',
                fontSize: '0.85rem',
              }}
            >
              {modifiersSummary}
            </p>
          )}
          {item.notes && (
            <p
              data-testid="cart-item-notes"
              style={{
                margin: 'var(--bento-spacing-xs) 0 0 0',
                color: 'var(--bento-text-muted)',
                fontSize: '0.85rem',
                fontStyle: 'italic',
              }}
            >
              Nota: {item.notes}
            </p>
          )}
          {item.addedBy && (
            <div style={{ marginTop: 'var(--bento-spacing-xs)' }}>
              <AddedByBadge addedBy={item.addedBy} />
            </div>
          )}
        </div>

        <KpiValue
          label="Subtotal"
          value={formatCOP(item.lineTotal)}
          tone="accent"
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 'var(--bento-spacing-sm)',
        }}
      >
        <QuantityStepper
          quantity={item.quantity}
          productName={item.productName}
          onIncrease={() => onUpdateQuantity?.(item.quantity + 1)}
          onDecrease={() => onUpdateQuantity?.(item.quantity - 1)}
          onRemove={() => (onRemove ? onRemove() : onUpdateQuantity?.(0))}
        />
      </div>
    </BentoCard>
  );
}
