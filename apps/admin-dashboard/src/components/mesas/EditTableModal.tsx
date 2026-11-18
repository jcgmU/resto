import { Modal } from '@packages/ui-components';
import React, { useEffect, useState } from 'react';
import { TableItem } from './types';
import { updateTable } from '../../lib/tablesApi';

export interface EditTableModalProps {
  table: TableItem | null;
  onClose: () => void;
  onSuccess: (updated: TableItem) => void | Promise<void>;
}

function formatConflictList(conflicts: unknown): string {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return '';
  const labels = conflicts
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'label' in item && typeof (item as any).label === 'string') {
        return (item as any).label;
      }
      return '';
    })
    .filter(Boolean);
  return labels.length > 0 ? ` (${labels.join(', ')})` : '';
}

export function EditTableModal({ table, onClose, onSuccess }: EditTableModalProps) {
  const [label, setLabel] = useState<string>(table?.label ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(
    table?.status === 'inactive' ? 'inactive' : 'active'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!table) return;
    setLabel(table.label ?? '');
    setStatus(table.status === 'inactive' ? 'inactive' : 'active');
    setError(null);
    setSaving(false);
  }, [table]);

  if (!table) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim().normalize('NFC');
    if (trimmedLabel.length < 1 || trimmedLabel.length > 40) {
      setError('El nombre de la mesa debe tener entre 1 y 40 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateTable(table.tableId, {
        label: trimmedLabel,
        status,
      });
      await onSuccess(updated);
      onClose();
    } catch (err: any) {
      const conflictSuffix = formatConflictList(err?.details?.conflicts);
      if (err?.code === 'TABLE_LABEL_TAKEN' || err?.status === 409) {
        setError(
          `El nombre de la mesa ya está en uso${conflictSuffix || ` (${trimmedLabel})`}.`
        );
      } else {
        setError(err?.message || 'Error al actualizar la mesa.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title={`Editar Mesa — ${table.label}`} onClose={onClose} maxWidth="440px" footer={<></>}>
        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bento-card-bg-solid)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-inner-radius)',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="edit-table-label-input"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
              }}
            >
              Nombre de la mesa
            </label>
            <input
              id="edit-table-label-input"
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-field-border)',
                backgroundColor: 'var(--bento-field-bg)',
                color: 'var(--bento-text)',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                fontFamily: 'var(--bento-font-body)',
              }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <span
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
              }}
            >
              Estado de la mesa
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                aria-pressed={status === 'active'}
                onClick={() => setStatus('active')}
                style={{
                  flex: 1,
                  minHeight: '42px',
                  padding: '8px 12px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border:
                    status === 'active'
                      ? '2px solid var(--bento-border)'
                      : '1px solid var(--bento-border)',
                  backgroundColor:
                    status === 'active' ? 'var(--bento-primary)' : 'var(--bento-card-bg-solid)',
                  color:
                    status === 'active' ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                Activa (Disponible)
              </button>
              <button
                type="button"
                aria-pressed={status === 'inactive'}
                onClick={() => setStatus('inactive')}
                style={{
                  flex: 1,
                  minHeight: '42px',
                  padding: '8px 12px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border:
                    status === 'inactive'
                      ? '2px solid var(--bento-border)'
                      : '1px solid var(--bento-border)',
                  backgroundColor:
                    status === 'inactive' ? 'var(--bento-primary)' : 'var(--bento-card-bg-solid)',
                  color:
                    status === 'inactive' ? 'var(--bento-card-bg-solid)' : 'var(--bento-text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                Deshabilitada (Inactiva)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                backgroundColor: 'transparent',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-primary)',
                color: 'var(--bento-card-bg-solid)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
