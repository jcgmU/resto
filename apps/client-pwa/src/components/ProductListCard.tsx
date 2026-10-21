import React from 'react';
import { ProductDTO, formatCOP } from '@packages/shared-types';
import { BentoCard, KpiValue } from '@packages/ui-components';

export interface ProductListCardProps {
  product: ProductDTO;
  onSelect?: () => void;
}

export function ProductListCard({ product, onSelect }: ProductListCardProps) {
  const isAvailable = product.isAvailable !== false;

  return (
    <BentoCard
      onClick={isAvailable ? onSelect : undefined}
      interactive={isAvailable}
      style={{
        opacity: isAvailable ? 1 : 0.65,
        cursor: isAvailable ? 'pointer' : 'not-allowed',
      }}
    >
      {product.imageUrl ? (
        <div style={{ marginBottom: 'var(--bento-spacing-sm)' }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            data-testid="product-image"
            style={{
              width: '100%',
              height: '130px',
              objectFit: 'cover',
              borderRadius: 'var(--bento-card-radius)',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div
          data-testid="product-image-fallback"
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
            <path d="M3 18h18" />
            <path d="M4 18a8 8 0 0 1 16 0" />
            <path d="M12 6V4" />
            <path d="M10 4h4" />
          </svg>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--bento-spacing-sm)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--bento-font-size-base, 1rem)',
            color: 'var(--bento-text)',
          }}
        >
          {product.name}
        </h3>
        {isAvailable && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'var(--bento-spacing-sm)',
        }}
      >
        <KpiValue
          label="Precio"
          value={formatCOP(product.price)}
          tone="accent"
        />

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
    </BentoCard>
  );
}
