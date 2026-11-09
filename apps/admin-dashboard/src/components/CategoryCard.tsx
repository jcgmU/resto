import React from 'react';
import { BentoCard } from '@packages/ui-components';
import type { CategoryDTO } from '@packages/shared-types';

export interface CategoryCardProps {
  category: CategoryDTO | {
    id: string;
    name: string;
    sortOrder?: number;
    destination?: string;
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
  const isBar = (category as any).destination === 'bar';

  return (
    <BentoCard style={{ minWidth: 0 }}>
      <div
        style={{
          padding: '4px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minWidth: 0,
        }}
      >
        {/* Zona 1: Cabecera con Nombre y Controles de Orden Compactos */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            minHeight: '2.4rem',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
              lineHeight: 1.25,
              wordBreak: 'break-word',
              flex: 1,
              minWidth: 0,
            }}
          >
            {category.name}
          </h3>

          {(onMoveUp || onMoveDown) && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              {onMoveUp && (
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => onMoveUp(category)}
                  aria-label={`Subir categoría ${category.name}`}
                  title={`Subir categoría ${category.name}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    padding: 0,
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: canMoveUp ? 'var(--bento-text)' : 'var(--bento-status-disabled)',
                    borderRadius: 'var(--bento-pill-radius)',
                    border: '1px solid var(--bento-border)',
                    cursor: canMoveUp ? 'pointer' : 'not-allowed',
                    opacity: canMoveUp ? 1 : 0.35,
                    transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => onMoveDown(category)}
                  aria-label={`Bajar categoría ${category.name}`}
                  title={`Bajar categoría ${category.name}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    padding: 0,
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: canMoveDown ? 'var(--bento-text)' : 'var(--bento-status-disabled)',
                    borderRadius: 'var(--bento-pill-radius)',
                    border: '1px solid var(--bento-border)',
                    cursor: canMoveDown ? 'pointer' : 'not-allowed',
                    opacity: canMoveDown ? 1 : 0.35,
                    transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zona 2: Etiqueta de Destino Semántica y Conteo de Platos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            data-destination={isBar ? 'bar' : 'kitchen'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: isBar
                ? 'var(--bento-status-available-bg)'
                : 'var(--bento-status-reserved-bg)',
              color: isBar
                ? 'var(--bento-status-available-text)'
                : 'var(--bento-status-reserved-text)',
              border: `1px solid ${isBar ? 'var(--bento-status-available)' : 'var(--bento-status-reserved)'}`,
            }}
          >
            {isBar ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="6 3 18 3 12 13 6 3" />
                <line x1="12" y1="13" x2="12" y2="21" />
                <line x1="8" y1="21" x2="16" y2="21" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            )}
            <span>{isBar ? 'Bar' : 'Cocina'}</span>
          </span>

          <span
            style={{
              margin: 0,
              color: 'var(--bento-text-muted)',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            {productCount} {productCount === 1 ? 'plato' : 'platos'}
          </span>
        </div>

        {/* Zona 3: Acciones Primaria (Editar) y Destructiva Accesible (Eliminar) */}
        {(onEdit || onDelete) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '4px',
              paddingTop: '10px',
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
                  backgroundColor: 'var(--bento-card-bg-solid)',
                  color: 'var(--bento-text)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-border)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
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
                data-destructive="true"
                data-color-token="var(--bento-status-occupied-text)"
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'var(--bento-status-occupied-bg)',
                  color: 'var(--bento-status-occupied-text)',
                  borderRadius: 'var(--bento-pill-radius)',
                  border: '1px solid var(--bento-status-occupied)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
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
