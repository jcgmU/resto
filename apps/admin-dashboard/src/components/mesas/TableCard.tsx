import React from 'react';
import { Button, StatusCard } from '@packages/ui-components';
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
    <StatusCard status={statusInfo.slotStatus === 'ocupada' ? 'occupied' : statusInfo.slotStatus === 'libre' ? 'available' : 'neutral'}>
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
            <span>{statusInfo.label}</span>
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
          <Button variant="secondary"
            type="button"
            onClick={() => onViewQr(table)}
            style={{
              flex: 1,
              minHeight: '40px',
              padding: '8px 12px',
              backgroundColor: 'var(--bento-card-bg-solid)',
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
          </Button>
          {canMutate && onEdit && (
            <Button variant="secondary"
              type="button"
              onClick={() => onEdit(table)}
              aria-label={`Editar ${table.label}`}
              style={{
                minHeight: '40px',
                padding: '8px 12px',
                backgroundColor: 'var(--bento-card-bg-solid)',
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
            </Button>
          )}
          {canMutate && onDelete && (
            <Button variant="danger"
              type="button"
              onClick={() => onDelete(table)}
              aria-label={`Eliminar ${table.label}`}
              style={{
                minHeight: '40px',
                padding: '8px 12px',
                backgroundColor: 'var(--bento-card-bg-solid)',
                color: 'var(--bento-destructive)',
                border: 'none',
                borderRadius: 'var(--bento-pill-radius)',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
                cursor: 'pointer',
              }}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </StatusCard>
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

  const slotFg = 'var(--bento-text)';

  return (
    <StatusCard
      status={isOccupied ? 'occupied' : isFree ? 'available' : 'neutral'}
      data-testid={`slot-${table.tableId}`}
      data-slot-status={statusInfo.slotStatus}
      style={{
        color: slotFg,
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
          <span>{statusInfo.label}</span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'var(--bento-text-muted)',
          }}
        >
          ID: {table.tableId}
        </p>
      </div>

      <div style={{ marginTop: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Button variant="secondary"
          type="button"
          onClick={() => onViewQr(table)}
          style={{
            flex: 1,
            width: '100%',
            minHeight: '36px',
            padding: '6px 12px',
            backgroundColor: isOccupied ? 'transparent' : 'var(--bento-panel-bg)',
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
        </Button>
        {canMutate && onEdit && (
          <Button variant="secondary"
            type="button"
            onClick={() => onEdit(table)}
            aria-label={`Editar ${table.label}`}
            style={{
              minHeight: '36px',
              padding: '6px 10px',
              backgroundColor: isOccupied ? 'transparent' : 'var(--bento-panel-bg)',
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
          </Button>
        )}
        {canMutate && onDelete && (
          <Button variant="danger"
            type="button"
            onClick={() => onDelete(table)}
            aria-label={`Eliminar ${table.label}`}
            style={{
              minHeight: '36px',
              padding: '6px 10px',
              backgroundColor: isOccupied ? 'transparent' : 'var(--bento-panel-bg)',
              color: 'var(--bento-destructive)',
              border: 'none',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.8rem',
              fontWeight: 600,
              fontFamily: 'var(--bento-font-body)',
              cursor: 'pointer',
            }}
          >
            Eliminar
          </Button>
        )}
      </div>
    </StatusCard>
  );
}
