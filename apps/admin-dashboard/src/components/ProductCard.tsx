import React from 'react';
import { BentoCard, KpiValue, AvailabilityToggle } from '@packages/ui-components';
import { formatCOP } from '@packages/shared-types';

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    categoryId: string;
    isAvailable: boolean;
    sortOrder?: number;
    tenantId?: string;
    imageUrl?: string | null;
    description?: string | null;
    prepTimeMinutes?: number | null;
  };
  categoryName?: string;
  onAvailabilityChange?: (isAvailable: boolean) => void;
  onEdit?: (product: any) => void;
  onDelete?: (product: any) => void;
}

export function ProductCard({
  product,
  categoryName,
  onAvailabilityChange,
  onEdit,
  onDelete,
}: ProductCardProps) {
  const isAvail = product.isAvailable !== false;

  return (
    <BentoCard>
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: '100%',
              height: '140px',
              objectFit: 'cover',
              borderRadius: 'var(--bento-inner-radius)',
            }}
          />
        ) : (
          <div
            data-testid="product-image-fallback"
            style={{
              width: '100%',
              height: '140px',
              borderRadius: 'var(--bento-inner-radius)',
              backgroundColor: 'color-mix(in srgb, var(--bento-primario, #5c6784) 10%, transparent)',
              border: '1px dashed var(--bento-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bento-text-muted)',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            <span>Carta</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
          {categoryName ? (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--bento-text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              Categoría: {categoryName}
            </span>
          ) : (
            <span />
          )}
          <span
            data-testid="availability-badge"
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: isAvail
                ? 'color-mix(in srgb, var(--bento-libre, #8fbf95) 25%, transparent)'
                : 'color-mix(in srgb, var(--bento-ocupada, #e0a6a6) 25%, transparent)',
              color: isAvail ? '#2d5a31' : '#8a2b2b',
            }}
          >
            {isAvail ? 'Disponible' : 'Agotado'}
          </span>
        </div>

        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--bento-text)' }}>
          {product.name}
        </h3>

        {product.description && (
          <p
            style={{
              margin: '0',
              fontSize: '0.8rem',
              color: 'var(--bento-text-muted)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
            }}
          >
            {product.description}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2px' }}>
          <KpiValue
            label="Precio"
            value={formatCOP(product.price)}
            tone="accent"
          />
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--bento-text-muted)',
              paddingBottom: '4px',
              fontWeight: 500,
            }}
          >
            {product.prepTimeMinutes ?? 15} min
          </span>
        </div>

        {onAvailabilityChange && (
          <div style={{ marginTop: '4px' }}>
            <AvailabilityToggle
              label="Disponible"
              checked={isAvail}
              onChange={onAvailabilityChange}
            />
          </div>
        )}

        {(onEdit || onDelete) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid var(--bento-border)',
            }}
          >
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                aria-label={`Editar ${product.name}`}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-text)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-border)',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                aria-label={`Eliminar ${product.name}`}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: 'var(--bento-destructive)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-destructive)',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </BentoCard>
  );
}
