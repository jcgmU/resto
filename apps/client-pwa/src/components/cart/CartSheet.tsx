import React, { useEffect, useRef, useState } from 'react';
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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
      setGeneralNotes('');
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const items = cart?.items || [];
  const hasItems = items.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (!dialogRef.current) return;
          const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
          if (nodes.length === 0) {
            e.preventDefault();
            return;
          }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === dialogRef.current)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
    >
      <div
        data-component="bento-card"
        style={{
          backgroundColor: 'var(--bento-card-bg)',
          borderRadius: 'var(--bento-card-radius) var(--bento-card-radius) 0 0',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--bento-card-shadow)',
        }}
      >
        <header
          style={{
            padding: 'var(--bento-spacing-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--bento-text)' }}>Tu Carrito</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar carrito"
            style={{
              minHeight: 'var(--bento-touch-target)',
              minWidth: 'var(--bento-touch-target)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

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
      </div>
    </div>
  );
}
