import React from 'react';
import { BentoCard } from '@packages/ui-components';
import type { CategoryDTO } from '@packages/shared-types';

export interface CategoryCardProps {
  category: CategoryDTO | {
    id: string;
    name: string;
    sortOrder?: number;
  };
  productCount?: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (category: any) => void;
  onMoveDown?: (category: any) => void;
  onEdit?: (category: any) => void;
  onDelete?: (category: any) => void;
}

export function CategoryCard({
  category,
  productCount = 0,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  return (
    <BentoCard>
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--bento-text)' }}>
              {category.name}
            </h3>
            <p style={{ margin: 0, color: 'var(--bento-text-muted)', fontSize: '0.85rem' }}>
              {productCount} {productCount === 1 ? 'plato' : 'platos'}
            </p>
          </div>
          {(onMoveUp || onMoveDown) && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {onMoveUp && (
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => onMoveUp(category)}
                  aria-label={`Subir categoría ${category.name}`}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--bento-papel)',
                    color: canMoveUp ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                    borderRadius: 'var(--bento-pill-radius)',
                    border: '1px solid var(--bento-border)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: canMoveUp ? 'pointer' : 'not-allowed',
                    opacity: canMoveUp ? 1 : 0.4,
                    minHeight: '32px',
                  }}
                >
                  Subir
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => onMoveDown(category)}
                  aria-label={`Bajar categoría ${category.name}`}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--bento-papel)',
                    color: canMoveDown ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                    borderRadius: 'var(--bento-pill-radius)',
                    border: '1px solid var(--bento-border)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: canMoveDown ? 'pointer' : 'not-allowed',
                    opacity: canMoveDown ? 1 : 0.4,
                    minHeight: '32px',
                  }}
                >
                  Bajar
                </button>
              )}
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '4px',
              paddingTop: '6px',
              borderTop: '1px solid var(--bento-border)',
            }}
          >
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(category)}
                aria-label={`Editar categoría ${category.name}`}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-text)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-border)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '34px',
                }}
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(category)}
                aria-label={`Eliminar categoría ${category.name}`}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: 'var(--bento-destructive)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-destructive)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '34px',
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
