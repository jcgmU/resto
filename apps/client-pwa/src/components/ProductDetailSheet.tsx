import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ProductDTO, formatCOP } from '@packages/shared-types';
import { ModifierGroupPicker } from './ModifierGroupPicker';
import { QuantityStepper } from './cart/QuantityStepper';

export interface ProductDetailSheetProps {
  product: ProductDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: ProductDTO, selectedModifiers: any[], quantity: number, notes?: string) => void;
  isOrderable?: boolean;
  orderBlockReason?: 'bill_requested' | 'waiter_only';
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProductDetailSheet({
  product,
  isOpen,
  onClose,
  onAddToCart,
  isOrderable = true,
  orderBlockReason,
}: ProductDetailSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
      setSelectedModifiers({});
      setQuantity(1);
      setItemNotes('');
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

  const isModifierValid = useMemo(() => {
    if (!product || !product.modifierGroups || product.modifierGroups.length === 0) {
      return true;
    }
    return product.modifierGroups.every((g) => {
      const minRequired = Math.max(g.minSelections || 0, g.isRequired ? 1 : 0);
      const selectedCount = (selectedModifiers[g.id] || []).length;
      return selectedCount >= minRequired;
    });
  }, [product, selectedModifiers]);

  if (!isOpen || !product) {
    return null;
  }

  const handleModifierChange = (groupId: string, selectedIds: string[]) => {
    setSelectedModifiers((prev) => ({
      ...prev,
      [groupId]: selectedIds,
    }));
  };

  const isAvailable = product.isAvailable !== false;

  const handleAdd = () => {
    if (!isModifierValid || !isOrderable || !isAvailable) {
      return;
    }

    const formattedMods: any[] = [];
    (product.modifierGroups || []).forEach((g) => {
      const selected = selectedModifiers[g.id] || [];
      selected.forEach((optId) => {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) {
          formattedMods.push({
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta || 0,
          });
        }
      });
    });

    const trimmedNotes = itemNotes.trim();
    if (trimmedNotes) {
      onAddToCart?.(product, formattedMods, quantity, trimmedNotes);
    } else {
      onAddToCart?.(product, formattedMods, quantity);
    }
    onClose();
  };

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
          background: 'var(--bento-card-bg)',
          borderRadius: 'var(--bento-card-radius) var(--bento-card-radius) 0 0',
          padding: 'var(--bento-spacing-md)',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--bento-card-shadow)',
        }}
      >
        {product.imageUrl ? (
          <div style={{ marginBottom: 'var(--bento-spacing-sm)', overflow: 'hidden', borderRadius: 'var(--bento-card-radius)' }}>
            <img
              src={product.imageUrl}
              alt={product.name}
              data-testid="product-detail-image"
              style={{
                width: '100%',
                maxHeight: '180px',
                objectFit: 'cover',
                borderRadius: 'var(--bento-card-radius)',
                display: 'block',
              }}
            />
          </div>
        ) : (
          <div
            data-testid="product-detail-image-fallback"
            style={{
              marginBottom: 'var(--bento-spacing-sm)',
              height: '90px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-subtle, rgba(0, 0, 0, 0.03))',
              border: '1px solid var(--bento-border, rgba(0, 0, 0, 0.06))',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bento-text-muted)',
            }}
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--bento-spacing-sm)',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--bento-text)' }}>{product.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--bento-spacing-md)' }}>
          <p style={{ color: 'var(--bento-accent-strong)', fontWeight: 700, margin: 0, fontSize: '1.25rem' }}>
            {formatCOP(product.price)}
          </p>

          {!isAvailable && (
            <span
              data-testid="badge-agotado"
              style={{
                color: 'var(--bento-destructive)',
                backgroundColor: 'var(--bento-destructive-subtle, rgba(239, 68, 68, 0.1))',
                border: '1px solid var(--bento-destructive)',
                borderRadius: 'var(--bento-pill-radius, 12px)',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              Agotado <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(No disponible)</span>
            </span>
          )}
        </div>

        {product.modifierGroups && product.modifierGroups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bento-spacing-sm)' }}>
            {product.modifierGroups.map((mg) => (
              <ModifierGroupPicker
                key={mg.id}
                group={mg}
                selectedOptions={selectedModifiers[mg.id] || []}
                onChange={(ids) => handleModifierChange(mg.id, ids)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--bento-spacing-sm)' }}>
          <label
            htmlFor="product-detail-notes"
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--bento-text)',
              marginBottom: '4px',
            }}
          >
            Instrucciones de preparación
          </label>
          <input
            id="product-detail-notes"
            type="text"
            placeholder="Instrucciones de preparación (ej. Sin cebolla)"
            value={itemNotes}
            onChange={(e) => setItemNotes(e.target.value)}
            maxLength={140}
            data-testid="item-notes-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              borderRadius: 'var(--bento-card-radius, 8px)',
              border: '1px solid var(--bento-border)',
              background: 'var(--bento-card-bg-solid)',
              color: 'var(--bento-text)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--bento-spacing-md)',
            paddingTop: 'var(--bento-spacing-sm)',
            borderTop: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--bento-text)' }}>Cantidad</span>
          <QuantityStepper
            quantity={quantity}
            productName={product.name}
            onIncrease={() => setQuantity((q) => q + 1)}
            onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
          />
        </div>

        {!isAvailable ? (
          <p
            role="alert"
            data-testid="product-unavailable-notice"
            style={{
              margin: 'var(--bento-spacing-sm) 0 0 0',
              color: 'var(--bento-destructive)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Este producto se encuentra agotado.
          </p>
        ) : !isOrderable ? (
          <p
            role="alert"
            data-testid="order-blocked-sheet-notice"
            style={{
              margin: 'var(--bento-spacing-sm) 0 0 0',
              color: 'var(--bento-destructive)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {orderBlockReason === 'waiter_only'
              ? 'El pedido por celular está desactivado. Un mesero tomará su orden.'
              : 'La cuenta ya fue solicitada y no se pueden agregar más pedidos.'}
          </p>
        ) : !isModifierValid ? (
          <p
            role="alert"
            style={{
              margin: 'var(--bento-spacing-sm) 0 0 0',
              color: 'var(--bento-destructive)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Selecciona las opciones obligatorias para continuar.
          </p>
        ) : null}

        <div style={{ marginTop: 'var(--bento-spacing-md)', display: 'flex', gap: 'var(--bento-spacing-sm)' }}>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isModifierValid || !isOrderable || !isAvailable}
            style={{
              minHeight: 'var(--bento-touch-target)',
              width: '100%',
              backgroundColor: isModifierValid && isOrderable && isAvailable ? 'var(--bento-accent-strong)' : 'var(--bento-card-bg-solid)',
              color: isModifierValid && isOrderable && isAvailable ? 'var(--bento-card-bg)' : 'var(--bento-text-muted)',
              borderRadius: 'var(--bento-card-radius)',
              border: isModifierValid && isOrderable && isAvailable ? 'none' : '1px solid var(--bento-border)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: isModifierValid && isOrderable && isAvailable ? 'pointer' : 'not-allowed',
              opacity: isModifierValid && isOrderable && isAvailable ? 1 : 0.6,
            }}
          >
            {!isAvailable
              ? 'Agotado'
              : !isOrderable
              ? orderBlockReason === 'waiter_only'
                ? 'Desactivado (Solo meseros)'
                : 'Cuenta solicitada'
              : 'Añadir al carrito'}
          </button>
        </div>
      </div>
    </div>
  );
}
