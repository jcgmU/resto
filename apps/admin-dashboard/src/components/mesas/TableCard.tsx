import React from 'react';
import { BentoCard, StatusChip } from '@packages/ui-components';
import type { TableItem, TableStatusInfo } from './types';

export interface TableCardProps {
  table: TableItem;
  statusInfo: TableStatusInfo;
  onViewQr: (table: TableItem) => void;
  selected?: boolean;
  onToggleSelect?: (tableId: string) => void;
  onEdit?: (table: TableItem) => void;
  onDelete?: (table: TableItem) => void;
  canMutate?: boolean;
}

export function TableCard({
  table,
  statusInfo,
  onViewQr,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  canMutate,
}: TableCardProps) {
  return (
    <BentoCard>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {canMutate && onToggleSelect && (
                <input
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={() => onToggleSelect(table.tableId)}
                  aria-label={`Seleccionar ${table.label}`}
                />
              )}
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-heading)',
                  color: 'var(--bento-text)',
                }}
              >
                {table.label}
              </h3>
            </div>
            <StatusChip label={statusInfo.label} tone={statusInfo.tone} />
          </div>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '0.8rem',
              color: 'var(--bento-text-muted)',
            }}
          >
            ID: {table.tableId}
            {table.createdAt && ` • Creada: ${new Date(table.createdAt).toLocaleDateString()}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onViewQr(table)}
            style={{
              flex: 1,
              minHeight: '40px',
              padding: '8px 12px',
              backgroundColor: 'var(--bento-papel)',
              color: 'var(--bento-text)',
              border: '1px solid var(--bento-border)',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'var(--bento-font-body)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Ver QR
          </button>
          {canMutate && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(table)}
              aria-label={`Editar ${table.label}`}
              style={{
                minHeight: '40px',
                padding: '8px 12px',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
                cursor: 'pointer',
              }}
            >
              Editar
            </button>
          )}
          {canMutate && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(table)}
              aria-label={`Eliminar ${table.label}`}
              style={{
                minHeight: '40px',
                padding: '8px 12px',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-destructive)',
                border: '1px solid var(--bento-destructive)',
                borderRadius: 'var(--bento-pill-radius)',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
                cursor: 'pointer',
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </BentoCard>
  );
}

export function TableMapSlot({
  table,
  statusInfo,
  onViewQr,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  canMutate,
}: TableCardProps) {
  const isOccupied = statusInfo.slotStatus === 'ocupada';
  const isFree = statusInfo.slotStatus === 'libre';

  const slotBg = isOccupied
    ? 'var(--bento-tinta)'
    : isFree
    ? 'var(--bento-papel)'
    : 'var(--bento-hueso)';

  const slotFg = isOccupied
    ? 'var(--bento-papel)'
    : isFree
    ? 'var(--bento-text)'
    : 'var(--bento-text-muted)';

  const slotBorder = isOccupied
    ? '1px solid var(--bento-tinta)'
    : isFree
    ? '1px dashed var(--bento-border)'
    : '1px solid var(--bento-border)';

  return (
    <div
      data-testid={`slot-${table.tableId}`}
      data-slot-status={statusInfo.slotStatus}
      style={{
        backgroundColor: slotBg,
        color: slotFg,
        border: slotBorder,
        borderRadius: 'var(--bento-inner-radius)',
        padding: '16px',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: isOccupied ? 'var(--bento-card-shadow)' : 'none',
        transition: 'transform 0.15s ease',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canMutate && onToggleSelect && (
              <input
                type="checkbox"
                checked={Boolean(selected)}
                onChange={() => onToggleSelect(table.tableId)}
                aria-label={`Seleccionar ${table.label}`}
              />
            )}
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: slotFg,
              }}
            >
              {table.label}
            </h3>
          </div>
          <StatusChip label={statusInfo.label} tone={statusInfo.tone} />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: isOccupied ? 'var(--bento-border)' : 'var(--bento-text-muted)',
          }}
        >
          ID: {table.tableId}
        </p>
      </div>

      <div style={{ marginTop: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onViewQr(table)}
          style={{
            flex: 1,
            width: '100%',
            minHeight: '36px',
            padding: '6px 12px',
            backgroundColor: isOccupied ? 'transparent' : 'var(--bento-hueso)',
            color: slotFg,
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-pill-radius)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--bento-font-body)',
            cursor: 'pointer',
          }}
        >
          Ver QR
        </button>
        {canMutate && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(table)}
            aria-label={`Editar ${table.label}`}
            style={{
              minHeight: '36px',
              padding: '6px 10px',
              backgroundColor: isOccupied ? 'transparent' : 'var(--bento-hueso)',
              color: slotFg,
              border: '1px solid var(--bento-border)',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'var(--bento-font-body)',
              cursor: 'pointer',
            }}
          >
            Editar
          </button>
        )}
        {canMutate && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(table)}
            aria-label={`Eliminar ${table.label}`}
            style={{
              minHeight: '36px',
              padding: '6px 10px',
              backgroundColor: isOccupied ? 'transparent' : 'var(--bento-hueso)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'var(--bento-font-body)',
              cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
