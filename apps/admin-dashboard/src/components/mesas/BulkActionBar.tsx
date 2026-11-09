import React from 'react';

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  busy?: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onActivateSelected: () => void;
  onDeactivateSelected: () => void;
  onBatchEditSelected: () => void;
  onDeleteSelected: () => void;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  busy = false,
  onToggleSelectAll,
  onClearSelection,
  onActivateSelected,
  onDeactivateSelected,
  onBatchEditSelected,
  onDeleteSelected,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Acciones en lote"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        backgroundColor: 'var(--bento-papel)',
        color: 'var(--bento-text)',
        border: '1px solid var(--bento-border)',
        borderRadius: 'var(--bento-card-radius)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'var(--bento-text)',
          }}
        >
          {selectedCount} seleccionada(s)
          {totalCount > 0 ? ` de ${totalCount}` : ''}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleSelectAll}
          style={{
            minHeight: '36px',
            padding: '0 12px',
            backgroundColor: 'var(--bento-hueso)',
            color: 'var(--bento-text)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClearSelection}
          style={{
            minHeight: '36px',
            padding: '0 12px',
            backgroundColor: 'transparent',
            color: 'var(--bento-text-muted)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Limpiar selección
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={onActivateSelected}
          style={{
            minHeight: '38px',
            padding: '0 14px',
            backgroundColor: 'var(--bento-papel)',
            color: 'var(--bento-text)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Activar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDeactivateSelected}
          style={{
            minHeight: '38px',
            padding: '0 14px',
            backgroundColor: 'var(--bento-papel)',
            color: 'var(--bento-text)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Desactivar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onBatchEditSelected}
          style={{
            minHeight: '38px',
            padding: '0 14px',
            backgroundColor: 'var(--bento-tinta)',
            color: 'var(--bento-papel)',
            border: '1px solid var(--bento-tinta)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Editar / Renombrar en lote
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDeleteSelected}
          style={{
            minHeight: '38px',
            padding: '0 14px',
            backgroundColor: 'var(--bento-destructive)',
            color: 'var(--bento-papel)',
            border: '1px solid var(--bento-destructive)',
            borderRadius: 'var(--bento-pill-radius)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Eliminar seleccionadas
        </button>
      </div>
    </div>
  );
}
