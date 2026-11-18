import React, { useEffect, useState } from 'react';
import { Button, Modal } from '@packages/ui-components';
import { CartDTO } from '@packages/shared-types';
import { CartLineItem } from './CartLineItem';
import { CartEmptyState } from './CartEmptyState';
import { CartSummaryBar } from './CartSummaryBar';

export interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart?: CartDTO | null;
  onConfirm?: (notes?: string) => Promise<void>;
  error?: string | null;
  onUpdateQuantity?: (cartItemId: string, quantity: number) => void;
  onRemoveItem?: (cartItemId: string) => void;
  isConfirming?: boolean;
  isOrderable?: boolean;
  orderBlockReason?: 'bill_requested' | 'waiter_only';
}

export function CartSheet({
  isOpen,
  onClose,
  cart,
  onConfirm,
  error,
  onUpdateQuantity,
  onRemoveItem,
  isConfirming,
  isOrderable = true,
  orderBlockReason,
}: CartSheetProps) {
  const [generalNotes, setGeneralNotes] = useState('');

  useEffect(() => {
    if (isOpen) setGeneralNotes('');
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const items = cart?.items || [];
  const hasItems = items.length > 0;

  return (
    <Modal open={isOpen} title="Tu Carrito" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Cerrar carrito</Button>}>
        {error && (
          <div
            role="alert"
            style={{
              padding: 'var(--bento-spacing-sm) var(--bento-spacing-md)',
              backgroundColor: 'var(--bento-destructive-subtle, rgba(239, 68, 68, 0.1))',
              color: 'var(--bento-destructive)',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {!isOrderable && (
          <div
            role="alert"
            data-testid="cart-order-blocked-alert"
            style={{
              padding: 'var(--bento-spacing-sm) var(--bento-spacing-md)',
              backgroundColor: 'var(--bento-destructive-subtle, rgba(239, 68, 68, 0.1))',
              color: 'var(--bento-destructive)',
              fontWeight: 600,
              fontSize: '0.9rem',
              fontFamily: 'var(--bento-font-body)',
            }}
          >
            {orderBlockReason === 'waiter_only'
              ? 'El pedido por celular está desactivado. Un mesero tomará su orden.'
              : 'La cuenta ya fue solicitada y no se pueden agregar más pedidos.'}
          </div>
        )}

        <div
          style={{
            padding: 'var(--bento-spacing-md)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--bento-spacing-sm)',
            flex: 1,
          }}
        >
          {!hasItems ? (
            <CartEmptyState />
          ) : (
            items.map((item) => (
              <CartLineItem
                key={item.cartItemId}
                item={item}
                onUpdateQuantity={(qty) => onUpdateQuantity?.(item.cartItemId, qty)}
                onRemove={() => (onRemoveItem ? onRemoveItem(item.cartItemId) : onUpdateQuantity?.(item.cartItemId, 0))}
              />
            ))
          )}
        </div>

        {hasItems && (
          <div style={{ padding: '0 var(--bento-spacing-md) var(--bento-spacing-sm)' }}>
            <label
              htmlFor="cart-general-notes"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
                marginBottom: '4px',
              }}
            >
              Otras solicitudes
            </label>
            <textarea
              id="cart-general-notes"
              data-testid="cart-general-notes-textarea"
              placeholder="Otras solicitudes para el pedido en general..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: 'var(--bento-card-radius, 8px)',
                border: '1px solid var(--bento-border)',
                background: 'var(--bento-card-bg-solid)',
                color: 'var(--bento-text)',
                fontSize: '0.85rem',
                resize: 'none',
              }}
            />
          </div>
        )}

        <CartSummaryBar
          total={cart?.total || 0}
          onConfirm={() => onConfirm?.(generalNotes.trim() || undefined)}
          disabled={!hasItems || !isOrderable}
          isConfirming={isConfirming}
        />
    </Modal>
  );
}
